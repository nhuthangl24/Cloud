import { fail, fromError, ok } from "@/lib/http";
import { uploadOwnedSingleFileP2P } from "@/server/services/file.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      uploadId, originalName, mimeType, size, folderId, displayName, description, tags, 
      telegramFileId, telegramMessageId, telegramChatId 
    } = body as {
      uploadId: string;
      originalName: string;
      mimeType?: string;
      size: number;
      folderId?: string | null;
      displayName?: string;
      description?: string;
      tags?: string[];
      telegramFileId: string;
      telegramMessageId: number;
      telegramChatId: string;
    };

    if (!uploadId || !originalName || !telegramFileId || typeof telegramMessageId !== 'number' || !telegramChatId) {
      return fail("Missing required fields: uploadId, originalName, telegram attributes");
    }

    const result = await uploadOwnedSingleFileP2P({
      uploadId,
      originalName,
      mimeType: mimeType || "application/octet-stream",
      size: Number(size),
      folderId: folderId ?? null,
      displayName,
      description,
      tags,
      telegramFileId,
      telegramMessageId,
      telegramChatId
    });

    return ok(result);
  } catch (error) {
    return fromError(error);
  }
}
