import { ok, fromError } from "@/lib/http";
import {
  telegramHealthCheck,
  telegramSendTestMessage,
} from "@/server/services/telegram.service";

export async function GET() {
  try {
    return ok(await telegramHealthCheck());
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      chatId?: string;
    };
    return ok(await telegramSendTestMessage(body.chatId));
  } catch (error) {
    return fromError(error);
  }
}
