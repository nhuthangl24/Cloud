import { fail, fromError } from "@/lib/http";
import {
  getFileByShareToken,
  incrementDownload,
  incrementShareDownload,
  createFileDownloadResponse,
} from "@/server/services/file.service";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(request: Request, context: RouteContext) {
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

    await incrementDownload(file);
    await incrementShareDownload(share.id);
    return await createFileDownloadResponse(file);
  } catch (error) {
    return fromError(error);
  }
}
