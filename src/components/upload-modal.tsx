"use client";

import { useEffect, useRef, useState } from "react";
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
import { useUpload } from "@/components/providers/upload-provider";

export function UploadModal() {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  
  const {
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
  } = useUpload();

  useEffect(() => {
    const input = folderInputRef.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
  }, []);

  useEffect(() => {
    if (open) {
      fetchFolders();
    } else {
      clearCompleted();
    }
    // fetchFolders and clearCompleted are stable context functions — no need as deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({
    onDrop: (files) => {
      queueFiles(files);
      setOpen(true);
    },
    noClick: true,
  });

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
            Tải lên chạy nền. Bạn có thể thu nhỏ cửa sổ này và xem tiến trình ngoài bảng.
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            {submitting ? 'Hide (Run in Background)' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
