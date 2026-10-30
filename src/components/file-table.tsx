"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Eye,
  Trash2,
  Edit2,
  LayoutGrid,
  List as ListIcon,
  Check,
  FileText,
  FileCode,
  Music,
  Video as VideoIcon,
  Image as ImageIcon,
  Archive,
  File as FileIcon,
  Loader2,
  CheckSquare,
  Square,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreateShareButton } from "@/components/create-share-button";
import { DeleteFileButton } from "@/components/delete-file-button";
import { FilePreviewModal, PreviewableFile } from "@/components/file-preview-modal";
import { formatBytes } from "@/lib/utils";
import { useUpload } from "@/components/providers/upload-provider";

export type FileRecordItem = {
  id: string;
  displayName: string;
  originalName: string;
  size: number;
  mimeType: string;
  category: string;
  extension?: string;
  downloadCount: number;
  createdAt: string;
  isDeleted?: boolean;
  tags?: string[];
};

type FileTableProps = {
  files: FileRecordItem[];
  title?: string;
};

export function FileTable({ files, title = "Files" }: FileTableProps) {
  const router = useRouter();
  const { items } = useUpload();

  const [viewMode, setViewMode] = useState<"list" | "grid">("grid");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<PreviewableFile | null>(null);

  // Rename Dialog state
  const [renameTarget, setRenameTarget] = useState<FileRecordItem | null>(null);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Batch delete state
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);

  const activeUploads = items.filter(
    (i) => i.status === "uploading" || i.status === "queued" || i.status === "error",
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map((f) => f.id)));
    }
  }

  function openRename(file: FileRecordItem) {
    setRenameTarget(file);
    setNewDisplayName(file.displayName);
  }

  async function handleRenameSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget || !newDisplayName.trim()) return;

    setIsRenaming(true);
    try {
      const res = await fetch(`/api/files/${renameTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newDisplayName.trim() }),
      });
      if (!res.ok) throw new Error("Rename failed");
      setRenameTarget(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename file");
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleBatchDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} selected file(s)?`)) return;

    setIsBatchDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await fetch(`/api/files/${id}`, { method: "DELETE" });
      }
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete some files");
    } finally {
      setIsBatchDeleting(false);
    }
  }

  function getFileIcon(category: string, mime: string, ext = "") {
    if (category === "image" || mime.startsWith("image/")) {
      return <ImageIcon className="h-6 w-6 text-emerald-500" />;
    }
    if (category === "video" || mime.startsWith("video/")) {
      return <VideoIcon className="h-6 w-6 text-indigo-500" />;
    }
    if (category === "audio" || mime.startsWith("audio/")) {
      return <Music className="h-6 w-6 text-rose-500" />;
    }
    if (category === "archive" || ["zip", "rar", "7z", "tar", "gz"].includes(ext.toLowerCase())) {
      return <Archive className="h-6 w-6 text-amber-500" />;
    }
    if (["pdf", "doc", "docx", "txt", "md"].includes(ext.toLowerCase())) {
      return <FileText className="h-6 w-6 text-blue-500" />;
    }
    if (["json", "js", "ts", "py", "html", "css", "sql"].includes(ext.toLowerCase())) {
      return <FileCode className="h-6 w-6 text-purple-500" />;
    }
    return <FileIcon className="h-6 w-6 text-muted-foreground" />;
  }

  return (
    <div className="space-y-4">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground font-medium">
            {files.length} file{files.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Multi-select Batch Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-1.5 animate-in fade-in">
              <span className="text-xs font-semibold text-primary">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={handleBatchDelete}
                disabled={isBatchDeleting}
              >
                {isBatchDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                Delete Selected
              </Button>
            </div>
          )}

          {/* Select all toggle */}
          {files.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={toggleSelectAll}
            >
              {selectedIds.size === files.length ? (
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              {selectedIds.size === files.length ? "Deselect All" : "Select All"}
            </Button>
          )}

          {/* Grid / List view toggle */}
          <div className="flex items-center rounded-xl border border-border bg-card p-0.5">
            <Button
              size="icon"
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              className="h-7 w-7 rounded-lg"
              onClick={() => setViewMode("grid")}
              title="Grid view"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "list" ? "secondary" : "ghost"}
              className="h-7 w-7 rounded-lg"
              onClick={() => setViewMode("list")}
              title="List view"
            >
              <ListIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Uploading queue banner */}
      {activeUploads.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-medium text-primary">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading {activeUploads.length} item(s)...
            </span>
          </div>
          <div className="space-y-2">
            {activeUploads.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs gap-3">
                <span className="truncate max-w-[300px] font-medium">{item.name}</span>
                <span className="text-muted-foreground">{item.statusText}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRID VIEW */}
      {viewMode === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {files.map((file) => {
            const isSelected = selectedIds.has(file.id);
            const ext = file.extension || file.originalName.split(".").pop() || "";
            return (
              <div
                key={file.id}
                className={`group relative flex flex-col justify-between rounded-2xl border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/50 ${
                  isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border/70"
                }`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => toggleSelect(file.id)}
                  className={`absolute top-3 left-3 z-10 flex h-6 w-6 items-center justify-center rounded-lg border transition ${
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/80 bg-background/80 opacity-0 group-hover:opacity-100 hover:border-primary"
                  }`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </button>

                {/* Card Icon & Category */}
                <div
                  className="flex items-center justify-center h-28 w-full rounded-xl bg-secondary/50 cursor-pointer transition hover:bg-secondary/70 mb-3"
                  onClick={() =>
                    setPreviewFile({
                      id: file.id,
                      displayName: file.displayName,
                      originalName: file.originalName,
                      size: file.size,
                      mimeType: file.mimeType,
                      category: file.category,
                      extension: ext,
                      downloadCount: file.downloadCount,
                      createdAt: file.createdAt,
                      tags: file.tags,
                    })
                  }
                >
                  {getFileIcon(file.category, file.mimeType, ext)}
                </div>

                {/* File info */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div
                    className="font-medium text-sm truncate cursor-pointer hover:text-primary transition"
                    title={file.displayName}
                    onClick={() =>
                      setPreviewFile({
                        id: file.id,
                        displayName: file.displayName,
                        originalName: file.originalName,
                        size: file.size,
                        mimeType: file.mimeType,
                        category: file.category,
                        extension: ext,
                        downloadCount: file.downloadCount,
                        createdAt: file.createdAt,
                        tags: file.tags,
                      })
                    }
                  >
                    {file.displayName}
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatBytes(file.size)}</span>
                    <span suppressHydrationWarning>{new Date(file.createdAt).toLocaleDateString("vi-VN")}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Preview"
                      onClick={() =>
                        setPreviewFile({
                          id: file.id,
                          displayName: file.displayName,
                          originalName: file.originalName,
                          size: file.size,
                          mimeType: file.mimeType,
                          category: file.category,
                          extension: ext,
                          downloadCount: file.downloadCount,
                          createdAt: file.createdAt,
                          tags: file.tags,
                        })
                      }
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      asChild
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Download"
                    >
                      <a href={`/api/files/${file.id}/download`} download={file.originalName}>
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      title="Rename"
                      onClick={() => openRename(file)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-1">
                    <CreateShareButton fileId={file.id} />
                    <DeleteFileButton fileId={file.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <Card className="border-border/70 overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-secondary/40 text-left text-xs font-semibold text-muted-foreground border-b border-border/70">
                <tr>
                  <th className="py-3 px-4 w-10">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="flex h-4 w-4 items-center justify-center rounded border border-border"
                    >
                      {selectedIds.size === files.length && files.length > 0 && (
                        <Check className="h-3 w-3 text-primary stroke-[3]" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-2">Name</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Size</th>
                  <th className="py-3 px-3">Tags</th>
                  <th className="py-3 px-3">Downloads</th>
                  <th className="py-3 px-3">Uploaded</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {files.map((file) => {
                  const isSelected = selectedIds.has(file.id);
                  const ext = file.extension || file.originalName.split(".").pop() || "";
                  return (
                    <tr
                      key={file.id}
                      className={`transition hover:bg-muted/40 ${isSelected ? "bg-primary/5" : ""}`}
                    >
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => toggleSelect(file.id)}
                          className={`flex h-4 w-4 items-center justify-center rounded border transition ${
                            isSelected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary"
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                        </button>
                      </td>
                      <td className="py-3 px-2">
                        <div
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() =>
                            setPreviewFile({
                              id: file.id,
                              displayName: file.displayName,
                              originalName: file.originalName,
                              size: file.size,
                              mimeType: file.mimeType,
                              category: file.category,
                              extension: ext,
                              downloadCount: file.downloadCount,
                              createdAt: file.createdAt,
                              tags: file.tags,
                            })
                          }
                        >
                          <div className="shrink-0">{getFileIcon(file.category, file.mimeType, ext)}</div>
                          <div className="min-w-0">
                            <div className="font-medium group-hover:text-primary transition truncate max-w-[280px]">
                              {file.displayName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[280px]">
                              {file.originalName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="text-xs font-normal">
                          {file.category}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground font-mono text-xs">
                        {formatBytes(file.size)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {(file.tags || []).slice(0, 2).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-[11px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-muted-foreground">{file.downloadCount}</td>
                      <td className="py-3 px-3 text-xs text-muted-foreground font-mono" suppressHydrationWarning>
                        {new Date(file.createdAt).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Preview"
                            onClick={() =>
                              setPreviewFile({
                                id: file.id,
                                displayName: file.displayName,
                                originalName: file.originalName,
                                size: file.size,
                                mimeType: file.mimeType,
                                category: file.category,
                                extension: ext,
                                downloadCount: file.downloadCount,
                                createdAt: file.createdAt,
                                tags: file.tags,
                              })
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Download"
                          >
                            <a href={`/api/files/${file.id}/download`} download={file.originalName}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Rename"
                            onClick={() => openRename(file)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <CreateShareButton fileId={file.id} />
                          <DeleteFileButton fileId={file.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {files.length === 0 && activeUploads.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border/80 p-12 text-center bg-card/40">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground mb-3">
            <FileIcon className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold mb-1">No files in this folder</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            Upload files or drop them here to store securely in your Telegram cloud storage.
          </p>
        </div>
      )}

      {/* Interactive Preview Modal */}
      <FilePreviewModal
        file={previewFile}
        open={Boolean(previewFile)}
        onOpenChange={(open) => !open && setPreviewFile(null)}
      />

      {/* Rename Dialog */}
      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenameSubmit} className="space-y-4 mt-2">
            <Input
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              placeholder="Enter new display name..."
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isRenaming || !newDisplayName.trim()}>
                {isRenaming ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
