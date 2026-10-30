import { fail, fromError, ok } from "@/lib/http";
import { requireServerSession } from "@/lib/auth";
import { getSystemSettings } from "@/server/services/settings.service";
import { uploadOwnedFile } from "@/server/services/file.service";
import { createLog } from "@/server/services/log.service";

export async function POST(request: Request) {
  try {
    await requireServerSession();

    const formData = await request.formData();
    const files = formData.getAll("files").filter((value): value is File => value instanceof File);

    if (files.length === 0) return fail("No files provided");

    const settings = await getSystemSettings();
    const allowedMimeTypes = settings.allowedMimeTypes as string[];
    const results = [];

    for (const [index, file] of files.entries()) {
      try {
        if (file.size > settings.maxFileSize) {
          throw new Error(`File ${file.name} exceeds maximum allowed size`);
        }

        if (!allowedMimeTypes.includes("*/*") && !allowedMimeTypes.includes(file.type)) {
          throw new Error(`MIME type ${file.type} is not allowed`);
        }

        const folderIdRaw = formData.get(`folderId:${index}`)?.toString() ?? formData.get("folderId")?.toString();
        const folderId = folderIdRaw && folderIdRaw !== "root" ? folderIdRaw : null;

        const result = await uploadOwnedFile({
          file,
          displayName:
            formData.get(`displayName:${index}`)?.toString() ??
            formData.get(`displayName:${file.name}`)?.toString() ??
            file.name,
          description:
            formData.get(`description:${index}`)?.toString() ??
            formData.get(`description:${file.name}`)?.toString() ??
            "",
          folderId,
          tags:
            formData
              .get(`tags:${index}`)
              ?.toString()
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean) ??
            formData
              .get(`tags:${file.name}`)
              ?.toString()
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean) ??
            [],
        });

        results.push({
          index,
          name: file.name,
          status: "success",
          deduplicated: result.deduplicated,
          file: result.file,
        });
      } catch (error) {
        await createLog({
          action: "UPLOAD",
          status: "ERROR",
          message: error instanceof Error ? error.message : "Upload failed",
          metadata: { fileName: file.name },
        }).catch(() => null);

        results.push({
          index,
          name: file.name,
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }

    return ok(results);
  } catch (error) {
    return fromError(error);
  }
}
