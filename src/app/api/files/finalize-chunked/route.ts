import { fail, fromError, ok } from "@/lib/http";
import { uploadOwnedChunkedFile } from "@/server/services/file.service";
import { FileChunk } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { uploadId, originalName, mimeType, size, chunks, folderId, displayName, description, tags } = body as {
      uploadId: string;
      originalName: string;
      mimeType?: string;
      size: number;
      chunks: FileChunk[];
      folderId?: string | null;
      displayName?: string;
      description?: string;
      tags?: string[];
    };

    if (!uploadId || !originalName || !Array.isArray(chunks) || chunks.length === 0) {
      return fail("Missing required fields: uploadId, originalName, chunks");
    }

    const result = await uploadOwnedChunkedFile({
      uploadId,
      originalName,
      mimeType: mimeType || "application/octet-stream",
      size: Number(size),
      chunks,
      folderId: folderId ?? null,
      displayName,
      description,
      tags,
    });

    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
