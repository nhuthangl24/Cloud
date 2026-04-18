import { ok, fail, fromError } from "@/lib/http";
import { requireServerSession } from "@/lib/auth";
import { getSystemSettings } from "@/server/services/settings.service";

export async function GET() {
  try {
    // Authenticate: Ensure only logged in users can get these tokens.
    await requireServerSession();

    const settings = await getSystemSettings();
    const tokens = settings.telegramTokens;

    if (!tokens || tokens.length === 0) {
      return fail("No Telegram Bot Tokens configured on server");
    }

    return ok({
      tokens,
      chatId: settings.telegramChatId,
      chunkSize: settings.chunkSize,
    });
  } catch (error) {
    return fromError(error);
  }
}
