"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileUp, FolderUp, Loader2, UploadCloud, X, XCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per chunk

type FolderOption = {
  id: string;
  name: string;
  path: string;
  parentId: string | null;
};

type QueuedUpload = {
  id: string;
  file: File;
  label: string;
  relativePath: string | null;
};

type UploadItem = {
  id: string;
  name: string;
  size: number;
  progress: number; // 0–100
  status: "queued" | "uploading" | "success" | "error";
  statusText?: string;
  error?: string;
};

type ChunkResult = {
  index: number;
  telegramFileId: string;
  telegramMessageId: number;
  telegramChatId: string;
  size: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** XHR upload with real progress events */
function xhrUpload(
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
          reject(new Error(err.error ?? `HTTP ${xhr.status}`));
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

export function UploadModal() {
  const router = useRouter();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [queuedUploads, setQueuedUploads] = useState<QueuedUpload[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [folders, setFolders] = useState<FolderOption[]>([]);
  const [folderId, setFolderId] = useState<string>("root");

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (!open) return;
    fetch("/api/folders")
      .then((res) => res.json())
      .then((payload) => { if (payload.success) setFolders(payload.data); })
      .catch(() => null);
  }, [open]);

  function queueFiles(acceptedFiles: File[]) {
    if (acceptedFiles.length === 0) return;
    const nextUploads = acceptedFiles.map((file) => {
      const df = file as File & { webkitRelativePath?: string };
      const relativePath = df.webkitRelativePath?.trim() || null;
      return { id: crypto.randomUUID(), file, label: relativePath || file.name, relativePath };
    });

    setOpen(true);
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

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({
    onDrop: queueFiles,
    noClick: true,
  });

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

  /** Small file — single XHR with real upload progress */
  async function uploadSingleFile(entry: QueuedUpload, targetFolderId: string | null) {
    const formData = new FormData();
    formData.append("files", entry.file);
    if (targetFolderId) formData.append("folderId:0", targetFolderId);

    const payload = await xhrUpload("/api/files/upload", formData, {}, (pct) => {
      updateItem(entry.id, {
        progress: pct,
        statusText: `Uploading… ${pct}%`,
      });
    }) as { success: boolean; error?: string; data?: { index: number; status: string; error?: string }[] };

    if (!payload.success) throw new Error(payload.error ?? "Upload failed");
    const result = payload.data?.[0];
    if (result?.status === "error") throw new Error(result.error ?? "Upload failed");
    return result;
  }

  /** Large file — chunk-by-chunk with real per-chunk progress */
  async function uploadChunkedFile(entry: QueuedUpload, targetFolderId: string | null) {
    const uploadId = crypto.randomUUID();
    const totalChunks = Math.ceil(entry.file.size / CHUNK_SIZE);
    
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
    const maxConcurrent = 10; // Đẩy lên 10 để bào tối đa băng thông nhờ Multi-Bot

    const uploadWorker = async () => {
      while (currentIndex < totalChunks) {
        const i = currentIndex++;
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, entry.file.size);
        const slice = entry.file.slice(start, end);
        const chunkFile = new File(
          [slice],
          `${entry.file.name}.part${String(i).padStart(4, "0")}`,
          { type: "application/octet-stream" },
        );

        const formData = new FormData();
        formData.append("chunk", chunkFile);
        formData.append("chunkIndex", String(i));
        formData.append("totalChunks", String(totalChunks));
        formData.append("uploadId", uploadId);

        const data = await xhrUpload("/api/files/upload-chunk", formData, {}, (pct) => {
          chunkProgresses[i] = pct * 0.9; // 90% goes to chunk uploads
          updateCombinedProgress();
        }) as { success: boolean; error?: string; data?: ChunkResult };

        if (!data.success) throw new Error(data.error ?? `Chunk ${i + 1} failed`);
        chunkResults[i] = data.data!;
      }
    };

    const workers = Array.from({ length: Math.min(maxConcurrent, totalChunks) }, uploadWorker);
    await Promise.all(workers);

    if (chunkResults.some((res) => res === null)) {
      throw new Error("Some chunks missing");
    }

    updateItem(entry.id, { progress: 92, statusText: "Finalizing…" });

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
    if (!finalData.success) throw new Error(finalData.error ?? "Finalize failed");
    return finalData.data;
  }

  async function handleUpload() {
    if (queuedUploads.length === 0 || submitting) return;
    setSubmitting(true);

    try {
      const folderCache = [...folders];

      for (const entry of queuedUploads) {
        try {
          updateItem(entry.id, { status: "uploading", progress: 0, statusText: "Starting…" });
          const targetFolderId = await ensureTargetFolder(entry.relativePath, folderCache);

          if (entry.file.size > CHUNK_SIZE) {
            await uploadChunkedFile(entry, targetFolderId);
          } else {
            await uploadSingleFile(entry, targetFolderId);
          }

          updateItem(entry.id, { status: "success", progress: 100, statusText: "Done ✓" });
        } catch (err) {
          updateItem(entry.id, {
            status: "error",
            progress: 0,
            statusText: undefined,
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }

      setFolders(folderCache);
      router.refresh();

      setItems((current) => {
        const hasError = current.some((i) => i.status === "error");
        if (!hasError) {
          setTimeout(() => {
            setQueuedUploads([]);
            setItems([]);
            setFolderId("root");
            setOpen(false);
          }, 1000);
        }
        return current;
      });
    } finally {
      setSubmitting(false);
    }
  }

  function removeFile(id: string) {
    if (submitting) return;
    setQueuedUploads((prev) => prev.filter((e) => e.id !== id));
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const doneCount = items.filter((i) => i.status === "success").length;
  const errorCount = items.filter((i) => i.status === "error").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload Files</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload To Telegram Storage</DialogTitle>
          <DialogDescription>
            File &gt; 4 MB sẽ tự động chia chunk và ghép lại khi tải xuống. (Tăng tốc độ tải lên đồng thời)
          </DialogDescription>
        </DialogHeader>

        {/* Folder selector */}
        <div className="mt-4">
          <Select value={folderId} onValueChange={setFolderId} disabled={submitting}>
            <SelectTrigger>
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="root">Root folder</SelectItem>
              {folders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  {folder.path}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Drop zone */}
        <div
          {...getRootProps()}
          className={`mt-4 rounded-2xl border border-dashed p-8 text-center transition ${
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <input {...getInputProps()} />
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(e) => { queueFiles(Array.from(e.target.files ?? [])); e.currentTarget.value = ""; }}
          />
          <UploadCloud className="mx-auto h-9 w-9 text-primary" />
          <p className="mt-3 font-medium">Drag &amp; drop files here</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button type="button" size="sm" onClick={openPicker} disabled={submitting}>
              <FileUp className="mr-1.5 h-3.5 w-3.5" /> Choose Files
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => folderInputRef.current?.click()} disabled={submitting}>
              <FolderUp className="mr-1.5 h-3.5 w-3.5" /> Choose Folder
            </Button>
          </div>
        </div>

        {/* File list */}
        {items.length > 0 && (
          <div className="mt-4 space-y-2">
            {/* Overall progress */}
            {submitting && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{doneCount} / {items.length} files</span>
                  <span>{totalProgress}%</span>
                </div>
                <Progress value={totalProgress} className="h-1.5" />
              </div>
            )}

            {/* Per-file rows */}
            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/70 p-3 space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        {item.status === "uploading" && (
                          <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                        )}
                        {item.status === "success" && (
                          <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                        )}
                        {item.status === "error" && (
                          <XCircle className="h-3 w-3 text-destructive shrink-0" />
                        )}
                        <span className={item.status === "error" ? "text-destructive" : ""}>
                          {item.status === "error" ? item.error : (item.statusText ?? item.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === "uploading" && (
                        <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                          {item.progress}%
                        </span>
                      )}
                      {!submitting && (
                        <button onClick={() => removeFile(item.id)} type="button" className="text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Per-file progress bar */}
                  {item.status === "uploading" && (
                    <Progress value={item.progress} className="h-1" />
                  )}
                  {item.status === "success" && (
                    <Progress value={100} className="h-1 [&>div]:bg-green-500" />
                  )}
                </div>
              ))}
            </div>

            {errorCount > 0 && !submitting && (
              <p className="text-xs text-destructive">{errorCount} file failed. Fix errors and retry.</p>
            )}
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            onClick={handleUpload}
            disabled={queuedUploads.length === 0 || submitting}
          >
            {submitting
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading…</>
              : <><FileUp className="mr-2 h-4 w-4" />Upload</>}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
