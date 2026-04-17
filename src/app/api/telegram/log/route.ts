import { fail, fromError, ok } from "@/lib/http";
import { sendTelegramLogMessage } from "@/server/services/telegram.service";

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text) return fail("Missing text");
    const msgId = await sendTelegramLogMessage(text);
    return ok({ messageId: msgId });
  } catch (error) {
    return fromError(error);
  }
}
