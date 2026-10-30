import { fromError } from "@/lib/http";
import { requireServerSession } from "@/lib/auth";
import {
  getFileById,
  incrementDownload,
  createFileDownloadResponse,
} from "@/server/services/file.service";
import { createLog } from "@/server/services/log.service";

type RouteContext = { params: Promise<{ id: string }> };

async function handleDownload(request: Request, context: RouteContext, isHead = false) {
  try {
    await requireServerSession();

    const { id } = await context.params;
    const file = await getFileById(id);

    const url = new URL(request.url);
    const isInline = url.searchParams.get("inline") === "1" || url.searchParams.get("preview") === "1";
    const rangeHeader = request.headers.get("range");

    // Only count as a download on first byte request or full download, not during repeated range seeks
    if (!rangeHeader || rangeHeader.startsWith("bytes=0-")) {
      await incrementDownload(file).catch(() => null);
      await createLog({
        action: "DOWNLOAD",
        status: "SUCCESS",
        message: `Downloaded ${file.displayName}`,
        fileId: file.id,
      }).catch(() => null);
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
  return handleDownload(request, context, false);
}

export async function HEAD(request: Request, context: RouteContext) {
  return handleDownload(request, context, true);
}
