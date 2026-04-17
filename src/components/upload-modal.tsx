"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, FolderUp, UploadCloud, X } from "lucide-react";
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
  progress: number;
  status: "queued" | "uploading" | "success" | "error";
  error?: string;
};

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
      .then((payload) => {
        if (payload.success) {
          setFolders(payload.data);
        }
      })
      .catch(() => null);
  }, [open]);

  function queueFiles(acceptedFiles: File[]) {
    if (acceptedFiles.length === 0) return;

    const nextUploads = acceptedFiles.map((file) => {
      const directoryFile = file as File & { webkitRelativePath?: string };
      const relativePath = directoryFile.webkitRelativePath?.trim() || null;
      return {
        id: crypto.randomUUID(),
        file,
        label: relativePath || file.name,
        relativePath,
      };
    });

    setOpen(true);
    setQueuedUploads((prev) => [...prev, ...nextUploads]);
    setItems((prev) => [
      ...prev,
      ...nextUploads.map((entry) => ({
        id: entry.id,
        name: entry.label,
        progress: 0,
        status: "queued" as const,
      })),
    ]);
  }

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({
    onDrop: queueFiles,
    noClick: true,
  });

  const totalProgress = useMemo(() => {
    if (items.length === 0) return 0;
    return items.reduce((sum, item) => sum + item.progress, 0) / items.length;
  }, [items]);

  async function createFolder(name: string, parentId: string | null) {
    const response = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId }),
    });
    const payload = await response.json();

    if (!payload.success) {
      throw new Error(payload.error ?? `Unable to create folder ${name}`);
    }

    return payload.data as FolderOption;
  }

  async function ensureTargetFolder(relativePath: string | null, folderCache: FolderOption[]) {
    let currentParentId = folderId === "root" ? null : folderId;

    if (!relativePath) {
      return currentParentId;
    }

    const segments = relativePath.split("/").slice(0, -1).filter(Boolean);
    if (segments.length === 0) {
      return currentParentId;
    }

    for (const segment of segments) {
      let folder = folderCache.find(
        (item) => item.parentId === currentParentId && item.name === segment,
      );

      if (!folder) {
        folder = await createFolder(segment, currentParentId);
        folderCache.push(folder);
      }

      currentParentId = folder.id;
    }

    return currentParentId;
  }

  async function handleUpload() {
    if (queuedUploads.length === 0 || submitting) return;

    setSubmitting(true);
    setItems((prev) => prev.map((item) => ({ ...item, status: "uploading", progress: 30 })));

    try {
      const formData = new FormData();
      const folderCache = [...folders];

      for (const [index, entry] of queuedUploads.entries()) {
        formData.append("files", entry.file);

        const targetFolderId = await ensureTargetFolder(entry.relativePath, folderCache);
        if (targetFolderId) {
          formData.append(`folderId:${index}`, targetFolderId);
        }
      }

      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json();

      const nextItems = items.map((item, index) => {
        const result = payload.data?.find((entry: { index: number }) => entry.index === index);
        return {
          ...item,
          progress: 100,
          status: result?.status === "success" ? "success" : "error",
          error: result?.error,
        } as UploadItem;
      });

      setItems(nextItems);
      setFolders(folderCache);
      router.refresh();

      const hasError = nextItems.some((item) => item.status === "error");
      if (!hasError) {
        setQueuedUploads([]);
        setItems([]);
        setFolderId("root");
        setOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function removeFile(id: string) {
    setQueuedUploads((prev) => prev.filter((entry) => entry.id !== id));
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Upload Files</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload To Telegram Storage</DialogTitle>
          <DialogDescription>
            Chọn file hoặc cả folder từ máy. Nếu folder local có subfolder, app sẽ tạo cấu trúc
            tương ứng trong storage.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <Select value={folderId} onValueChange={setFolderId}>
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

        <div
          {...getRootProps()}
          className={`mt-6 rounded-2xl border border-dashed p-10 text-center transition ${
            isDragActive ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <input {...getInputProps()} />
          <input
            ref={folderInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={(event) => {
              queueFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
          <UploadCloud className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-4 font-medium">Drag & drop files here</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Drop files, choose files, hoặc chọn cả folder từ máy rồi bấm Upload.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button type="button" onClick={openPicker}>
              <FileUp className="mr-2 h-4 w-4" />
              Choose Files
            </Button>
            <Button type="button" variant="outline" onClick={() => folderInputRef.current?.click()}>
              <FolderUp className="mr-2 h-4 w-4" />
              Choose Folder
            </Button>
          </div>
        </div>

        {items.length > 0 ? (
          <div className="mt-6 space-y-3">
            <Progress value={totalProgress} />
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-border/70 p-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.status === "error" ? item.error : item.status}
                  </div>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <div className="text-sm">{item.progress}%</div>
                  <button onClick={() => removeFile(item.id)} type="button">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" onClick={handleUpload} disabled={queuedUploads.length === 0 || submitting}>
            <FileUp className="mr-2 h-4 w-4" />
            {submitting ? "Uploading..." : "Upload"}
          </Button>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
