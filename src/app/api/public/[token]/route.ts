import { fail, fromError } from "@/lib/http";
import {
  getFileByShareToken,
  incrementDownload,
  incrementShareDownload,
  createFileDownloadResponse,
} from "@/server/services/file.service";

type RouteContext = { params: Promise<{ token: string }> };

async function handlePublicDownload(request: Request, context: RouteContext, isHead = false) {
  try {
    const { token } = await context.params;
    const resolved = await getFileByShareToken(token);
    if (!resolved) return fail("Invalid link", 404);

    const { share, file } = resolved;
    if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
      return fail("Link expired", 410);
    }
    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      return fail("Download limit reached", 410);
    }

    const url = new URL(request.url);
    const password = url.searchParams.get("password");
    if (share.password && password !== share.password) {
      return fail("Password required", 401);
    }

    if (file.isDeleted) return fail("File unavailable", 404);

    const isInline = url.searchParams.get("inline") === "1" || url.searchParams.get("preview") === "1";
    const rangeHeader = request.headers.get("range");

    if (!rangeHeader || rangeHeader.startsWith("bytes=0-")) {
      await incrementDownload(file).catch(() => null);
      await incrementShareDownload(share.id).catch(() => null);
    }

    const response = await createFileDownloadResponse(file, {
      disposition: isInline ? "inline" : "attachment",
      rangeHeader,
    });

    if (isHead) {
      return new Response(null, {
        status: response.status,
        headers: response.headers,
      });
    }

    return response;
  } catch (error) {
    return fromError(error);
  }
}

export async function GET(request: Request, context: RouteContext) {
  return handlePublicDownload(request, context, false);
}

export async function HEAD(request: Request, context: RouteContext) {
  return handlePublicDownload(request, context, true);
}
