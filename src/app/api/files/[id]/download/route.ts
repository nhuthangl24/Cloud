import { fromError } from "@/lib/http";
import { getFileById, incrementDownload, resolveDownloadUrl } from "@/server/services/file.service";
import { createLog } from "@/server/services/log.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const file = await getFileById(id);
    const url = await resolveDownloadUrl(file);

    await incrementDownload(file);
    await createLog({
      action: "DOWNLOAD",
      status: "SUCCESS",
      message: `Downloaded ${file.displayName}`,
      fileId: file.id,
    });

    return Response.redirect(url, 302);
  } catch (error) {
    return fromError(error);
  }
}
