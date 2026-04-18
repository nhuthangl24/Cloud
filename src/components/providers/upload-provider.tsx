"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";

export const CHUNK_SIZE = 20 * 1024 * 1024; // 19 MB — must be < 20 MB (Telegram getFile API hard limit)

export type FolderOption = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
};

export type QueuedUpload = {
  id: string;
  file: File;
  label: string;
  relativePath: string | null;
};

export type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0–100
  status: "queued" | "uploading" | "success" | "error";
  statusText?: string;
  error?: string;
};

export type ChunkResult = {
  index: number;
  telegramFileId: string;
  telegramMessageId: number;
  telegramChatId: string;
  size: number;
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function xhrUpload(
  url: string,
  body: FormData | string,
  headers: Record<string, string> = {},
  onProgress?: (pct: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve(xhr.responseText);
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.description ?? err.error ?? `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Request timed out"));

    xhr.open("POST", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(body);
  });
}

type TelegramSendDocumentResult = {
  ok: boolean;
  description?: string;
  result: {
    message_id: number;
    chat: { id: string | number };
    document?: { file_id: string };
    video?: { file_id: string };
    audio?: { file_id: string };
    photo?: Array<{ file_id: string }>;
  };
};

type TelegramConfig = {
  tokens: string[];
  chatId: string;
  chunkSize: number;
};

type UploadContextType = {
  items: UploadItem[];
  queuedUploads: QueuedUpload[];
  submitting: boolean;
  folders: FolderOption[];
  folderId: string;
  setFolderId: (id: string) => void;
  queueFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  handleUpload: () => void;
  fetchFolders: () => void;
  totalProgress: number;
  clearCompleted: () => void;
};

const UploadContext = createContext<UploadContextType | null>(null);

export function UploadProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [queuedUploads, setQueuedUploads] = useState<QueuedUpload[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [folderId, setFolderId] = useState<string>("root");

  function fetchFolders() {
    fetch("/api/folders")
      .then((res) => res.json())
      .then((payload) => {
        if (payload.success) setFolders(payload.data);
      })
      .catch(() => null);
  }

  function queueFiles(acceptedFiles: File[]) {
    if (acceptedFiles.length === 0) return;
    const nextUploads = acceptedFiles.map((file) => {
      const df = file as File & { webkitRelativePath?: string };
      const relativePath = df.webkitRelativePath?.trim() || null;
      return { id: crypto.randomUUID(), file, label: relativePath || file.name, relativePath };
    });

    setQueuedUploads((prev) => [...prev, ...nextUploads]);
    setItems((prev) => [
      ...prev,
      ...nextUploads.map((entry) => ({
        id: entry.id,
        name: entry.label,
        size: entry.file.size,
        progress: 0,
        status: "queued" as const,
        statusText: entry.file.size > CHUNK_SIZE
          ? `${Math.ceil(entry.file.size / CHUNK_SIZE)} chunks · ${formatBytes(entry.file.size)}`
          : formatBytes(entry.file.size),
      })),
    ]);
  }

  const totalProgress = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.round(items.reduce((sum, i) => sum + i.progress, 0) / items.length);
  }, [items]);

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function createFolder(name: string, parentId: string | null) {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    });
    const payload = await res.json();
    if (!payload.success) throw new Error(payload.error ?? `Cannot create folder ${name}`);
    return payload.data as FolderOption;
  }

  async function ensureTargetFolder(relativePath: string | null, folderCache: FolderOption[]) {
    let currentParentId = folderId === "root" ? null : folderId;
    if (!relativePath) return currentParentId;
    const segments = relativePath.split("/").slice(0, -1).filter(Boolean);
    for (const segment of segments) {
      let folder = folderCache.find((f) => f.parentId === currentParentId && f.name === segment);
      if (!folder) {
        folder = await createFolder(segment, currentParentId);
        folderCache.push(folder);
      }
      currentParentId = folder.id;
    }
    return currentParentId;
  }

  async function getTelegramConfig(): Promise<TelegramConfig> {
    const res = await fetch("/api/telegram/config");
    const payload = await res.json();
    if (!payload.success) throw new Error(payload.error ?? "Failed to fetch telegram config");
    return payload.data as TelegramConfig;
  }

  async function uploadSingleFileP2P(entry: QueuedUpload, targetFolderId: string | null, config: TelegramConfig) {
    const uploadId = crypto.randomUUID();
    const token = config.tokens[0] || config.tokens[0];
    const formData = new FormData();
    formData.append("chat_id", config.chatId);
    formData.append("document", entry.file);

    const payload = await xhrUpload(`https://api.telegram.org/bot${token}/sendDocument`, formData, {}, (pct) => {
      updateItem(entry.id, { progress: pct, statusText: `Uploading… ${pct}%` });
    }) as TelegramSendDocumentResult;

    if (!payload.ok) throw new Error(payload.description ?? "Upload failed");
    const resultDoc = payload.result.document || payload.result.video || payload.result.audio || (payload.result.photo && payload.result.photo[payload.result.photo.length - 1]);
    
    if(!resultDoc?.file_id) throw new Error("No file_id returned from Telegram");

    let fileIdToSave = resultDoc.file_id;
    if(config.tokens.length > 1) {
       fileIdToSave = `0|${fileIdToSave}`;
    }

    updateItem(entry.id, { progress: 95, statusText: "Finalizing…" });

    const finalRes = await fetch("/api/files/finalize-single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        originalName: entry.file.name,
        mimeType: entry.file.type || "application/octet-stream",
        size: entry.file.size,
        folderId: targetFolderId,
        telegramFileId: fileIdToSave,
        telegramMessageId: payload.result.message_id,
        telegramChatId: String(payload.result.chat.id),
      }),
    });

    const finalData = await finalRes.json();
    if (!finalData.success) throw new Error(finalData.error ?? "Finalize failed");
    return finalData.data;
  }

  async function uploadChunkedFileP2P(entry: QueuedUpload, targetFolderId: string | null, config: TelegramConfig) {
    const uploadId = crypto.randomUUID();
    const chunkSize = config.chunkSize || CHUNK_SIZE;
    const totalChunks = Math.ceil(entry.file.size / chunkSize);
    
    const chunkResults: ChunkResult[] = new Array(totalChunks).fill(null);
    const chunkProgresses: number[] = new Array(totalChunks).fill(0);

    const updateCombinedProgress = () => {
      const overallPct = Math.round(
        chunkProgresses.reduce((sum, p) => sum + p, 0) / totalChunks
      );
      updateItem(entry.id, {
        progress: overallPct,
        statusText: `Uploading chunks… ${overallPct}%`,
      });
    };

    let currentIndex = 0;
    const maxConcurrent = 10;

    const uploadWorker = async () => {
      while (currentIndex < totalChunks) {
        const i = currentIndex++;
        const tokenIndex = i % config.tokens.length;
        const botToken = config.tokens[tokenIndex];

        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, entry.file.size);
        const slice = entry.file.slice(start, end);
        const chunkFile = new File(
          [slice],
          `${entry.file.name}.part${String(i).padStart(4, "0")}`,
          { type: "application/octet-stream" },
        );

        const formData = new FormData();
        formData.append("chat_id", config.chatId);
        formData.append("document", chunkFile);

        const payload = await xhrUpload(`https://api.telegram.org/bot${botToken}/sendDocument`, formData, {}, (pct) => {
          chunkProgresses[i] = pct * 0.95;
          updateCombinedProgress();
        }) as TelegramSendDocumentResult;

        if (!payload.ok) throw new Error(payload.description ?? `Chunk ${i + 1} failed`);
        const resultDoc = payload.result.document || payload.result.video || payload.result.audio || (payload.result.photo && payload.result.photo[payload.result.photo.length - 1]);
        if(!resultDoc?.file_id) throw new Error("No file_id returned from Telegram");
        
        chunkResults[i] = {
           index: i,
           telegramFileId: config.tokens.length > 1 ? `${tokenIndex}|${resultDoc.file_id}` : resultDoc.file_id,
           telegramMessageId: payload.result.message_id,
           telegramChatId: String(payload.result.chat.id),
           size: chunkFile.size
        };
      }
    };

    const workers = Array.from({ length: Math.min(maxConcurrent, totalChunks) }, uploadWorker);
    await Promise.all(workers);

    if (chunkResults.some((res) => res === null)) {
      throw new Error("Some chunks missing");
    }

    updateItem(entry.id, { progress: 95, statusText: "Finalizing…" });

    const res = await fetch("/api/files/finalize-chunked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uploadId,
        originalName: entry.file.name,
        mimeType: entry.file.type || "application/octet-stream",
        size: entry.file.size,
        chunks: chunkResults,
        folderId: targetFolderId,
      }),
    });

    const finalData = await res.json();
    if (!finalData.success) throw new Error(finalData.error ?? "Finalize chunk metadata failed");
    return finalData.data;
  }

  async function handleUpload() {
    if (queuedUploads.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      const folderCache = [...folders];
      const config = await getTelegramConfig();

      for (const entry of queuedUploads) {
        try {
          updateItem(entry.id, { status: "uploading", progress: 0, statusText: "P2P Initiating…" });
          const targetFolderId = await ensureTargetFolder(entry.relativePath, folderCache);

          if (entry.file.size > (config.chunkSize || CHUNK_SIZE)) {
            await uploadChunkedFileP2P(entry, targetFolderId, config);
          } else {
            await uploadSingleFileP2P(entry, targetFolderId, config);
          }

          updateItem(entry.id, { status: "success", progress: 100, statusText: "Done ✓" });
        } catch (err) {
          updateItem(entry.id, {
            status: "error",
            progress: 0,
            statusText: undefined,
            error: err instanceof Error ? err.message : "P2P Upload failed",
          });
        }
      }

      setFolders(folderCache);
      router.refresh(); 

      setTimeout(() => {
        setItems((current) => current.filter(i => i.status !== "success"));
        setQueuedUploads((current) => current.filter(q => items.some(i => i.id === q.id && i.status !== "success")));
      }, 5000);

    } catch (e: unknown) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Failed to fetch P2P config");
    } finally {
      setSubmitting(false);
      setQueuedUploads([]); 
    }
  }

  function removeFile(id: string) {
    if (submitting) return;
    setQueuedUploads((prev) => prev.filter((e) => e.id !== id));
    setItems((prev) => prev.filter((i) => i.id !== id));
  }
  
  function clearCompleted() {
    setItems((prev) => prev.filter((i) => i.status !== "success"));
  }

  return (
    <UploadContext.Provider
      value={{
        items,
        queuedUploads,
        submitting,
        folders,
        folderId,
        setFolderId,
        queueFiles,
        removeFile,
        handleUpload,
        fetchFolders,
        totalProgress,
        clearCompleted
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUpload must be used within an UploadProvider");
  return context;
}
