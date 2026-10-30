import { ok, fromError } from "@/lib/http";
import { requireServerSession } from "@/lib/auth";
import { getSystemSettings } from "@/server/services/settings.service";
import { getBotTokens } from "@/server/services/telegram.service";

export async function GET() {
  try {
    await requireServerSession();

    const settings = await getSystemSettings();
    const tokens = await getBotTokens();

    const hasTokens = Boolean(tokens && tokens.length > 0);
    const hasChat = Boolean(settings.telegramChatId && settings.telegramChatId !== "-1000000000000");

    // Return safe configuration: NEVER expose raw bot token strings to client!
    return ok({
      configured: hasTokens && hasChat,
      hasTokens,
      botCount: tokens.length,
      chatConfigured: hasChat,
      chunkSize: settings.chunkSize || 15 * 1024 * 1024,
      maxFileSize: settings.maxFileSize,
    });
  } catch (error) {
    return fromError(error);
  }
}
