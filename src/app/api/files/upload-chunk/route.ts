import { fail, fromError, ok } from "@/lib/http";
import { uploadFileToTelegram } from "@/server/services/telegram.service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const chunk = formData.get("chunk");
    const chunkIndex = Number(formData.get("chunkIndex"));
    const totalChunks = Number(formData.get("totalChunks"));

    if (!(chunk instanceof File)) return fail("No chunk provided");
    if (isNaN(chunkIndex) || isNaN(totalChunks)) return fail("Invalid chunk metadata");

    const result = await uploadFileToTelegram(chunk);

    return ok({
      index: chunkIndex,
      telegramFileId: result.telegramFileId,
      telegramMessageId: result.telegramMessageId,
      telegramChatId: result.telegramChatId,
      size: chunk.size,
    });
  } catch (error) {
    return fromError(error);
  }
}
