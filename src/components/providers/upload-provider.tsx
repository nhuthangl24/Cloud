"use client";

import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle, X, RotateCw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export const CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB chunks for high stability with Telegram Bot API

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
  bytesUploaded: number;
  speed: string; // e.g. "4.2 MB/s"
  eta: string; // e.g. "15s"
  status: "queued" | "uploading" | "success" | "error";
  statusText?: string;
  error?: string;
  retry?: () => void;
};

export type ChunkResult = {
  index: number;
  telegramFileId: string;
  telegramMessageId: number;
  telegramChatId: string;
  size: number;
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "--";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function xhrUpload(
  url: string,
  body: FormData | string,
  headers: Record<string, string> = {},
  onProgress?: (pct: number, loadedBytes: number, totalBytes: number) => void,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const pct = Math.round((e.loaded / e.total) * 100);
        onProgress(pct, e.loaded, e.total);
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

    xhr.onerror = () => reject(new Error("Network connection error"));
    xhr.ontimeout = () => reject(new Error("Upload request timed out"));

    xhr.open("POST", url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.send(body);
  });
}

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
  const [minimized, setMinimized] = useState(false);

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
        bytesUploaded: 0,
        speed: "--",
        eta: "--",
        status: "queued" as const,
        statusText:
          entry.file.size > CHUNK_SIZE
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

  // Upload single file (< 15 MB) through server streaming
  async function uploadSingleFileServer(entry: QueuedUpload, targetFolderId: string | null) {
    const formData = new FormData();
    formData.append("files", entry.file);
    if (targetFolderId) formData.append("folderId", targetFolderId);
    formData.append("displayName:0", entry.file.name);

    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    const payload = (await xhrUpload(
      "/api/files/upload",
      formData,
      {},
      (pct, loaded, total) => {
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        let speedStr = "--";
        let etaStr = "--";

        if (timeDiff >= 0.5) {
          const bytesDiff = loaded - lastLoaded;
          const bytesPerSec = bytesDiff / timeDiff;
          speedStr = `${formatBytes(bytesPerSec)}/s`;
          const remainingBytes = total - loaded;
          etaStr = formatEta(bytesPerSec > 0 ? remainingBytes / bytesPerSec : 0);
          lastLoaded = loaded;
          lastTime = now;
        }

        updateItem(entry.id, {
          progress: Math.min(99, pct),
          bytesUploaded: loaded,
          speed: speedStr,
          eta: etaStr,
          statusText: `Uploading: ${pct}% · ${speedStr}`,
        });
      },
    )) as { success: boolean; error?: string; data?: Array<{ status: string; error?: string }> };

    if (!payload.success) {
      throw new Error(payload.error || "Upload failed");
    }
    if (payload.data && payload.data[0]?.status === "error") {
      throw new Error(payload.data[0].error || "Upload error");
    }

    updateItem(entry.id, {
      progress: 100,
      bytesUploaded: entry.file.size,
      speed: "--",
      eta: "0s",
      status: "success",
      statusText: "Done ✓",
    });
  }

  // Upload large file (> 15 MB) sliced into chunks through server streaming
  async function uploadChunkedFileServer(entry: QueuedUpload, targetFolderId: string | null) {
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(entry.file.size / CHUNK_SIZE);

    const chunkResults: ChunkResult[] = new Array(totalChunks).fill(null);
    const chunkProgresses: number[] = new Array(totalChunks).fill(0);
    const chunkBytes: number[] = new Array(totalChunks).fill(0);

    const startTime = Date.now();
    let lastLoadedTotal = 0;
    let lastTime = startTime;

    const updateCombinedProgress = () => {
      const totalLoaded = chunkBytes.reduce((sum, b) => sum + b, 0);
      const overallPct = Math.min(98, Math.round((totalLoaded / entry.file.size) * 100));

      const now = Date.now();
      const timeDiff = (now - lastTime) / 1000;
      let speedStr = "--";
      let etaStr = "--";

      if (timeDiff >= 0.5) {
        const bytesDiff = totalLoaded - lastLoadedTotal;
        const bytesPerSec = bytesDiff / timeDiff;
        speedStr = `${formatBytes(bytesPerSec)}/s`;
        const remainingBytes = entry.file.size - totalLoaded;
        etaStr = formatEta(bytesPerSec > 0 ? remainingBytes / bytesPerSec : 0);
        lastLoadedTotal = totalLoaded;
        lastTime = now;
      }

      updateItem(entry.id, {
        progress: overallPct,
        bytesUploaded: totalLoaded,
        speed: speedStr,
        eta: etaStr,
        statusText: `Uploading chunks (${overallPct}%) · ${speedStr}`,
      });
    };

    let currentIndex = 0;
    const concurrency = Math.min(3, totalChunks); // 3 parallel chunks for smooth network utilization

    const worker = async () => {
      while (currentIndex < totalChunks) {
        const i = currentIndex++;
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, entry.file.size);
        const slice = entry.file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", slice);
        formData.append("chunkIndex", String(i));
        formData.append("totalChunks", String(totalChunks));
        formData.append("filename", entry.file.name);

        let retryCount = 0;
        let success = false;
        while (!success && retryCount < 3) {
          try {
            const res = (await xhrUpload(
              "/api/files/upload-chunk",
              formData,
              {},
              (pct, loaded) => {
                chunkProgresses[i] = pct;
                chunkBytes[i] = loaded;
                updateCombinedProgress();
              },
            )) as { success: boolean; data: ChunkResult; error?: string };

            if (!res.success || !res.data) {
              throw new Error(res.error || `Chunk ${i + 1} rejected`);
            }

            chunkResults[i] = res.data;
            chunkBytes[i] = slice.size;
            chunkProgresses[i] = 100;
            success = true;
          } catch (err) {
            retryCount++;
            if (retryCount >= 3) throw err;
            await new Promise((r) => setTimeout(r, 1500 * retryCount));
          }
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));

    if (chunkResults.some((c) => c === null)) {
      throw new Error("One or more chunks failed to upload");
    }

    updateItem(entry.id, {
      progress: 99,
      statusText: "Finalizing assembly...",
    });

    const finalizeRes = await fetch("/api/files/finalize-chunked", {
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

    const finalData = await finalizeRes.json();
    if (!finalData.success) {
      throw new Error(finalData.error || "Assembly finalization failed");
    }

    updateItem(entry.id, {
      progress: 100,
      bytesUploaded: entry.file.size,
      speed: "--",
      eta: "0s",
      status: "success",
      statusText: "Done ✓",
    });
  }

  async function uploadFileEntry(entry: QueuedUpload, targetFolderId: string | null) {
    updateItem(entry.id, {
      status: "uploading",
      progress: 0,
      speed: "--",
      eta: "--",
      statusText: "Starting...",
    });

    if (entry.file.size > CHUNK_SIZE) {
      await uploadChunkedFileServer(entry, targetFolderId);
    } else {
      await uploadSingleFileServer(entry, targetFolderId);
    }
  }

  async function handleUpload() {
    if (queuedUploads.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      const folderCache = [...folders];

      for (const entry of queuedUploads) {
        try {
          const targetFolderId = await ensureTargetFolder(entry.relativePath, folderCache);
          await uploadFileEntry(entry, targetFolderId);
        } catch (err) {
          updateItem(entry.id, {
            status: "error",
            progress: 0,
            statusText: "Failed",
            error: err instanceof Error ? err.message : "Upload error",
            retry: () => uploadFileEntry(entry, folderId === "root" ? null : folderId),
          });
        }
      }

      setFolders(folderCache);
      router.refresh();
    } catch (e: unknown) {
      console.error(e);
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

  const activeCount = items.filter((i) => i.status === "uploading" || i.status === "queued").length;
  const hasItems = items.length > 0;

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
        clearCompleted,
      }}
    >
      {children}

      {/* Floating Upload Dock Manager (Google Drive / Dropbox Style) */}
      {hasItems && (
        <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-border/80 bg-card shadow-2xl backdrop-blur-md transition-all">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-2">
              {activeCount > 0 ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              )}
              <span className="text-sm font-semibold">
                {activeCount > 0
                  ? `Uploading ${activeCount} item${activeCount > 1 ? "s" : ""} (${totalProgress}%)`
                  : "All uploads complete"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setMinimized((m) => !m)}
              >
                {minimized ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={clearCompleted}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!minimized && (
            <div className="max-h-72 overflow-y-auto divide-y divide-border/40 p-2">
              {items.map((item) => (
                <div key={item.id} className="p-2 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate max-w-[200px]">{item.name}</span>
                    <span className="text-muted-foreground">{formatBytes(item.size)}</span>
                  </div>

                  {item.status === "uploading" && (
                    <>
                      <Progress value={item.progress} className="h-1.5" />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{item.speed}</span>
                        <span>{item.progress}% · ETA {item.eta}</span>
                      </div>
                    </>
                  )}

                  {item.status === "queued" && (
                    <div className="text-muted-foreground italic">In queue...</div>
                  )}

                  {item.status === "success" && (
                    <div className="flex items-center gap-1 text-emerald-500 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Uploaded successfully
                    </div>
                  )}

                  {item.status === "error" && (
                    <div className="flex items-center justify-between text-destructive">
                      <span className="truncate flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        {item.error || "Upload failed"}
                      </span>
                      {item.retry && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => item.retry?.()}
                        >
                          <RotateCw className="h-3 w-3 mr-1" /> Retry
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </UploadContext.Provider>
  );
}

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) throw new Error("useUpload must be used within an UploadProvider");
  return context;
}
