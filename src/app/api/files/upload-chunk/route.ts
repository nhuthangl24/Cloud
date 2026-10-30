import { fail, fromError, ok } from "@/lib/http";
import { requireServerSession } from "@/lib/auth";
import { uploadFileToTelegram } from "@/server/services/telegram.service";

export async function POST(request: Request) {
  try {
    await requireServerSession();

    const formData = await request.formData();
    const chunk = formData.get("chunk");
    const chunkIndex = Number(formData.get("chunkIndex"));
    const totalChunks = Number(formData.get("totalChunks"));
    const filename = formData.get("filename")?.toString() || "chunk.bin";

    if (!(chunk instanceof Blob)) {
      return fail("No valid chunk binary provided");
    }
    if (isNaN(chunkIndex) || isNaN(totalChunks)) {
      return fail("Invalid chunk metadata");
    }

    const chunkFileName = `${filename}.part${String(chunkIndex).padStart(4, "0")}`;
    const result = await uploadFileToTelegram(chunk, chunkFileName);

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
