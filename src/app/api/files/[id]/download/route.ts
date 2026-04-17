import { fromError } from "@/lib/http";
import {
  getFileById,
  incrementDownload,
  createFileDownloadResponse,
} from "@/server/services/file.service";
import { createLog } from "@/server/services/log.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const file = await getFileById(id);

    await incrementDownload(file);
    await createLog({
      action: "DOWNLOAD",
      status: "SUCCESS",
      message: `Downloaded ${file.displayName}`,
      fileId: file.id,
    });

    return await createFileDownloadResponse(file);
  } catch (error) {
    return fromError(error);
  }
}
