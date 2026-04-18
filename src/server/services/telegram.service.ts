import { env } from "@/lib/env";

export function getBotTokens(): string[] {
  if (env.TELEGRAM_BOT_TOKENS) {
    const list = env.TELEGRAM_BOT_TOKENS.split(",").map((s) => s.trim()).filter(Boolean);
    if (list.length > 0) return list;
  }
  return [env.TELEGRAM_BOT_TOKEN];
}

let roundRobinIndex = 0;

export function getNextBotToken(): { token: string; index: number } {
  const tokens = getBotTokens();
  const index = roundRobinIndex % tokens.length;
  roundRobinIndex++;
  return { token: tokens[index], index };
}

type TelegramUploadResult = {
  telegramFileId: string;
  telegramUniqueFileId?: string;
  telegramMessageId: number;
  telegramChatId: string;
};

async function telegramFetch<T>(
  endpoint: string,
  init?: RequestInit,
  retries = 3,
  token?: string,
): Promise<T> {
  const actualToken = token || env.TELEGRAM_BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${actualToken}${endpoint}`, init);
  const data = await response.json().catch(() => ({ ok: false, description: "Invalid JSON response" }));
  if (!response.ok || !data.ok) {
    if (response.status === 429 && data.parameters?.retry_after && retries > 0) {
      const waitTime = data.parameters.retry_after * 1000;
      console.warn(`[telegram.service] rate limit hit. Waiting ${data.parameters.retry_after}s...`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return telegramFetch<T>(endpoint, init, retries - 1, actualToken);
    }
    throw new Error(data.description || "Telegram API error");
  }
  return data.result as T;
}

export async function uploadFileToTelegram(
  file: File,
): Promise<TelegramUploadResult> {
  const { token, index } = getNextBotToken();
  const formData = new FormData();
  formData.append("chat_id", env.TELEGRAM_STORAGE_CHAT_ID);
  formData.append("caption", `Cloud Nhu Thang: ${file.name}`);
  formData.append("document", file);

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

  return {
    telegramFileId: getBotTokens().length > 1 ? `${index}|${filePayload.file_id}` : filePayload.file_id,
    telegramUniqueFileId: filePayload.file_unique_id,
    telegramMessageId: result.message_id,
    telegramChatId: String(result.chat.id),
  };
}

export async function getTelegramFilePath(rawFileId: string) {
  let fileId = rawFileId;
  let token = env.TELEGRAM_BOT_TOKEN;
  if (rawFileId.includes("|")) {
    const parts = rawFileId.split("|", 2);
    const tokens = getBotTokens();
    const idx = parseInt(parts[0], 10);
    if (!isNaN(idx) && tokens[idx]) {
      token = tokens[idx];
    }
    fileId = parts[1];
  }

  const result = await telegramFetch<{ file_path: string }>("/getFile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  }, 3, token);

  return { filePath: result.file_path, token };
}

export async function getTelegramFileDownloadUrl(rawFileId: string) {
  const { filePath, token } = await getTelegramFilePath(rawFileId);
  return `https://api.telegram.org/file/bot${token}/${filePath}`;
}

export async function deleteTelegramMessage(messageId: number, chatId: string) {
  await telegramFetch("/deleteMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
    }),
  });
}

export async function telegramHealthCheck() {
  const me = await telegramFetch<{ id: number; username: string }>("/getMe");
  return {
    ok: true,
    botId: me.id,
    username: me.username,
    storageChatId: env.TELEGRAM_STORAGE_CHAT_ID,
  };
}

export async function telegramSendTestMessage(customChatId?: string) {
  const chatId = customChatId || env.TELEGRAM_STORAGE_CHAT_ID;
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
      text: "Cloud Telegram test message",
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

export async function sendTelegramLogMessage(text: string) {
  const result = await telegramFetch<{ message_id: number }>("/sendMessage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_STORAGE_CHAT_ID,
      text,
    }),
  });
  return result.message_id;
}

export async function groupTelegramDocuments(chatId: string, fileIds: string[], caption?: string) {
  if (getBotTokens().length > 1) return []; // Cannot group cleanly across multiple bots

  // Telegram allows max 10 media per group. We chunk the requests if there are more.
  const results: Array<{ message_id: number; file_id: string }> = [];
  
  for (let i = 0; i < fileIds.length; i += 10) {
    const batch = fileIds.slice(i, i + 10);
    const media = batch.map((fileId, idx) => ({
      type: "document",
      media: fileId.includes("|") ? fileId.split("|")[1] : fileId,
      caption: (i === 0 && idx === 0) ? caption : undefined,
    }));

    const payloads = await telegramFetch<Array<{
      message_id: number;
      document?: { file_id: string };
    }>>("/sendMediaGroup", {
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
