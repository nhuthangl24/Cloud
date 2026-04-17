import { env } from "@/lib/env";

const TELEGRAM_API = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}`;

type TelegramUploadResult = {
  telegramFileId: string;
  telegramUniqueFileId?: string;
  telegramMessageId: number;
  telegramChatId: string;
};

async function telegramFetch<T>(
  endpoint: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${TELEGRAM_API}${endpoint}`, init);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || "Telegram API error");
  }
  return data.result as T;
}

export async function uploadFileToTelegram(
  file: File,
): Promise<TelegramUploadResult> {
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
  }>("/sendDocument", { method: "POST", body: formData });

  const filePayload =
    result.document ??
    result.video ??
    result.audio ??
    (result.photo ? result.photo[result.photo.length - 1] : undefined);

  if (!filePayload?.file_id) {
    throw new Error("Telegram did not return file_id");
  }

  return {
    telegramFileId: filePayload.file_id,
    telegramUniqueFileId: filePayload.file_unique_id,
    telegramMessageId: result.message_id,
    telegramChatId: String(result.chat.id),
  };
}

export async function getTelegramFilePath(fileId: string) {
  const result = await telegramFetch<{ file_path: string }>("/getFile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });

  return result.file_path;
}

export async function getTelegramFileDownloadUrl(fileId: string) {
  const filePath = await getTelegramFilePath(fileId);
  return `${TELEGRAM_FILE_API}/${filePath}`;
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
  // Telegram allows max 10 media per group. We chunk the requests if there are more.
  const results: Array<{ message_id: number; file_id: string }> = [];
  
  for (let i = 0; i < fileIds.length; i += 10) {
    const batch = fileIds.slice(i, i + 10);
    const media = batch.map((fileId, idx) => ({
      type: "document",
      media: fileId,
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
