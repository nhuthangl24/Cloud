import { env } from "@/lib/env";
import { getSystemSettings } from "@/server/services/settings.service";

export type TelegramUploadResult = {
  telegramFileId: string;
  telegramUniqueFileId?: string;
  telegramMessageId: number;
  telegramChatId: string;
};

// Cache for getFile results to avoid duplicate Telegram API calls (valid for 45 mins)
type CachedFilePath = {
  filePath: string;
  token: string;
  expiresAt: number;
};
const filePathCache = new Map<string, CachedFilePath>();

export async function getBotTokens(): Promise<string[]> {
  try {
    const settings = await getSystemSettings();
    if (settings?.telegramTokens && settings.telegramTokens.length > 0) {
      const valid = settings.telegramTokens
        .map((t) => t.trim())
        .filter((t) => Boolean(t) && t !== "telegram-token-placeholder");
      if (valid.length > 0) return valid;
    }
  } catch {
    // ignore and fallback to env
  }

  if (env.TELEGRAM_BOT_TOKENS) {
    const fromList = env.TELEGRAM_BOT_TOKENS.split(",")
      .map((t) => t.trim())
      .filter((t) => Boolean(t) && t !== "telegram-token-placeholder");
    if (fromList.length > 0) return fromList;
  }

  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN !== "telegram-token-placeholder") {
    return [env.TELEGRAM_BOT_TOKEN.trim()];
  }

  return [];
}

export function getBotIdFromToken(token: string): string {
  const parts = token.split(":");
  return parts[0] || "";
}

let roundRobinIndex = 0;

export async function getNextBotToken(): Promise<{ token: string; botId: string; index: number }> {
  const tokens = await getBotTokens();
  if (tokens.length === 0) {
    throw new Error("No Telegram bots configured. Please set TELEGRAM_BOT_TOKEN or configure in Settings.");
  }

  const index = Math.abs(roundRobinIndex) % tokens.length;
  roundRobinIndex++;
  const token = tokens[index];
  return { token, botId: getBotIdFromToken(token), index };
}

export async function getTelegramChatId(): Promise<string> {
  try {
    const settings = await getSystemSettings();
    if (settings?.telegramChatId && settings.telegramChatId.trim() && settings.telegramChatId !== "-1000000000000") {
      return settings.telegramChatId.trim();
    }
  } catch {}

  return env.TELEGRAM_STORAGE_CHAT_ID;
}

async function telegramFetch<T>(
  endpoint: string,
  init?: RequestInit,
  retries = 3,
  token?: string,
): Promise<T> {
  let actualToken = token;
  if (!actualToken) {
    const tokens = await getBotTokens();
    actualToken = tokens[0];
  }
  if (!actualToken) {
    throw new Error("No Telegram Bot token provided");
  }

  const url = `https://api.telegram.org/bot${actualToken}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (netErr) {
    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return telegramFetch<T>(endpoint, init, retries - 1, actualToken);
    }
    throw new Error(`Network failure connecting to Telegram: ${netErr instanceof Error ? netErr.message : "unknown"}`);
  }

  const data = await response.json().catch(() => ({ ok: false, description: "Invalid JSON response from Telegram" }));

  if (!response.ok || !data.ok) {
    if (response.status === 429 && data.parameters?.retry_after && retries > 0) {
      const waitTime = Math.min(data.parameters.retry_after * 1000, 30000);
      console.warn(`[telegram.service] rate limited. Waiting ${data.parameters.retry_after}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return telegramFetch<T>(endpoint, init, retries - 1, actualToken);
    }
    throw new Error(data.description || `Telegram API error (${response.status})`);
  }

  return data.result as T;
}

export async function uploadFileToTelegram(
  file: File | Blob,
  customFilename?: string,
): Promise<TelegramUploadResult> {
  const { token, botId } = await getNextBotToken();
  const chatId = await getTelegramChatId();

  const formData = new FormData();
  formData.append("chat_id", chatId);
  
  const filename = customFilename || (file instanceof File ? file.name : "upload.bin");
  formData.append("caption", `Cloud: ${filename}`);
  formData.append("document", file, filename);

  const result = await telegramFetch<{
    message_id: number;
    chat: { id: string | number };
    document?: { file_id: string; file_unique_id?: string };
    video?: { file_id: string; file_unique_id?: string };
    audio?: { file_id: string; file_unique_id?: string };
    photo?: Array<{ file_id: string; file_unique_id?: string }>;
  }>("/sendDocument", { method: "POST", body: formData }, 3, token);

  const filePayload =
    result.document ??
    result.video ??
    result.audio ??
    (result.photo ? result.photo[result.photo.length - 1] : undefined);

  if (!filePayload?.file_id) {
    throw new Error("Telegram did not return file_id");
  }

  // Prefix with botId for deterministic matching
  const telegramFileId = `bot_${botId}:${filePayload.file_id}`;

  return {
    telegramFileId,
    telegramUniqueFileId: filePayload.file_unique_id,
    telegramMessageId: result.message_id,
    telegramChatId: String(result.chat.id),
  };
}

export async function getTelegramFilePath(rawFileId: string): Promise<{ filePath: string; token: string }> {
  // Check in-memory cache first
  const cached = filePathCache.get(rawFileId);
  if (cached && Date.now() < cached.expiresAt) {
    return { filePath: cached.filePath, token: cached.token };
  }

  const tokens = await getBotTokens();
  if (tokens.length === 0) {
    throw new Error("No Telegram bot tokens configured");
  }

  let cleanFileId = rawFileId;
  let preferredToken: string | null = null;

  // Format 1: bot_<botId>:<fileId>
  if (rawFileId.startsWith("bot_")) {
    const colonIdx = rawFileId.indexOf(":");
    if (colonIdx !== -1) {
      const botId = rawFileId.substring(4, colonIdx);
      cleanFileId = rawFileId.substring(colonIdx + 1);
      const match = tokens.find((t) => getBotIdFromToken(t) === botId);
      if (match) preferredToken = match;
    }
  }
  // Format 2: <index>|<fileId> (legacy)
  else if (rawFileId.includes("|")) {
    const parts = rawFileId.split("|", 2);
    const idx = parseInt(parts[0], 10);
    if (!isNaN(idx) && tokens[idx]) {
      preferredToken = tokens[idx];
    }
    cleanFileId = parts[1];
  }

  // Candidates list: preferred token first, then other available tokens
  const candidateTokens: string[] = [];
  if (preferredToken) candidateTokens.push(preferredToken);
  for (const t of tokens) {
    if (!candidateTokens.includes(t)) candidateTokens.push(t);
  }

  let lastError: Error | null = null;
  for (const token of candidateTokens) {
    try {
      const result = await telegramFetch<{ file_path: string }>(
        "/getFile",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_id: cleanFileId }),
        },
        2,
        token,
      );

      if (result?.file_path) {
        // Cache for 45 minutes (Telegram download link valid for at least 1 hour)
        filePathCache.set(rawFileId, {
          filePath: result.file_path,
          token,
          expiresAt: Date.now() + 45 * 60 * 1000,
        });
        return { filePath: result.file_path, token };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      // If error is not "wrong file_id" or 400, continue to next token
    }
  }

  throw lastError || new Error(`Could not resolve Telegram file path for ${rawFileId}`);
}

export async function getTelegramFileDownloadUrl(rawFileId: string): Promise<string> {
  const { filePath, token } = await getTelegramFilePath(rawFileId);
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

export async function getTelegramDownloadStream(
  rawFileId: string,
  range?: { start?: number; end?: number },
): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentLength: number;
  status: number;
  rawHeaders: Headers;
}> {
  const { filePath, token } = await getTelegramFilePath(rawFileId);
  const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

  const requestHeaders: Record<string, string> = {};
  if (range && (range.start !== undefined || range.end !== undefined)) {
    const startStr = range.start !== undefined ? String(range.start) : "";
    const endStr = range.end !== undefined ? String(range.end) : "";
    requestHeaders["Range"] = `bytes=${startStr}-${endStr}`;
  }

  let tgRes: Response | null = null;
  let attempts = 0;
  while (attempts < 3) {
    attempts++;
    try {
      const response = await fetch(downloadUrl, {
        headers: requestHeaders,
        // 60-second abort signal for network stalling
        signal: AbortSignal.timeout(60000),
      });

      // If token/link expired (404 / 401), invalidate cache and retry with fresh getFile
      if ((response.status === 404 || response.status === 401) && attempts < 3) {
        filePathCache.delete(rawFileId);
        const refreshed = await getTelegramFilePath(rawFileId);
        const newUrl = `https://api.telegram.org/file/bot${refreshed.token}/${refreshed.filePath}`;
        const retryRes = await fetch(newUrl, { headers: requestHeaders });
        if (retryRes.ok || retryRes.status === 206) {
          tgRes = retryRes;
          break;
        }
      }

      if (response.ok || response.status === 206) {
        tgRes = response;
        break;
      }

      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, 2000 * attempts));
        continue;
      }

      throw new Error(`Telegram CDN returned status ${response.status}`);
    } catch (err) {
      if (attempts >= 3) {
        throw err instanceof Error ? err : new Error(`Download failed: ${String(err)}`);
      }
      await new Promise((r) => setTimeout(r, 1000 * attempts));
    }
  }

  if (!tgRes || !tgRes.body) {
    throw new Error("Empty body received from Telegram CDN");
  }

  const lengthHeader = tgRes.headers.get("content-length");
  const contentLength = lengthHeader ? parseInt(lengthHeader, 10) : 0;

  return {
    stream: tgRes.body,
    contentLength,
    status: tgRes.status,
    rawHeaders: tgRes.headers,
  };
}

export async function deleteTelegramMessage(messageId: number, chatId: string): Promise<void> {
  const tokens = await getBotTokens();
  for (const token of tokens) {
    try {
      await telegramFetch(
        "/deleteMessage",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
        },
        1,
        token,
      );
      return;
    } catch {
      // Try next token if this bot wasn't the sender
    }
  }
}

export async function telegramHealthCheck() {
  const tokens = await getBotTokens();
  if (tokens.length === 0) {
    return { ok: false, error: "No Telegram bot tokens configured" };
  }

  const me = await telegramFetch<{ id: number; username: string }>("/getMe");
  const chatId = await getTelegramChatId();

  return {
    ok: true,
    botId: me.id,
    username: me.username,
    storageChatId: chatId,
    totalConfiguredBots: tokens.length,
  };
}

export async function telegramSendTestMessage(customChatId?: string) {
  const chatId = customChatId || (await getTelegramChatId());
  const result = await telegramFetch<{
    message_id: number;
    chat: { id: string | number; type: string; title?: string };
    date: number;
    text: string;
  }>("/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "⚡ Cloud Telegram test connection: Successful!",
    }),
  });

  return {
    ok: true,
    requestedChatId: chatId,
    resolvedChatId: String(result.chat.id),
    chatType: result.chat.type,
    title: result.chat.title,
    messageId: result.message_id,
  };
}

export async function sendTelegramLogMessage(text: string): Promise<number> {
  const chatId = await getTelegramChatId();
  const result = await telegramFetch<{ message_id: number }>("/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });
  return result.message_id;
}

export async function groupTelegramDocuments(chatId: string, fileIds: string[], caption?: string) {
  const tokens = await getBotTokens();
  if (tokens.length > 1) return [];

  const results: Array<{ message_id: number; file_id: string }> = [];

  for (let i = 0; i < fileIds.length; i += 10) {
    const batch = fileIds.slice(i, i + 10);
    const media = batch.map((fileId, idx) => {
      let clean = fileId;
      if (clean.startsWith("bot_")) {
        const col = clean.indexOf(":");
        if (col !== -1) clean = clean.substring(col + 1);
      } else if (clean.includes("|")) {
        clean = clean.split("|")[1];
      }
      return {
        type: "document",
        media: clean,
        caption: i === 0 && idx === 0 ? caption : undefined,
      };
    });

    const payloads = await telegramFetch<
      Array<{
        message_id: number;
        document?: { file_id: string };
      }>
    >("/sendMediaGroup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, media }),
    });

    for (let j = 0; j < payloads.length; j++) {
      results.push({
        message_id: payloads[j].message_id,
        file_id: payloads[j].document?.file_id ?? batch[j],
      });
    }
  }

  return results;
}
