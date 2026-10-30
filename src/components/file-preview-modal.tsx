/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import {
  Download,
  Share2,
  ExternalLink,
  Music,
  File as FileIcon,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";

export type PreviewableFile = {
  id: string;
  displayName: string;
  originalName: string;
  size: number;
  mimeType: string;
  category: string;
  extension: string;
  downloadCount: number;
  createdAt: string;
  tags?: string[];
};

type FilePreviewModalProps = {
  file: PreviewableFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare?: (fileId: string) => void;
};

export function FilePreviewModal({ file, open, onOpenChange, onShare }: FilePreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState(false);

  const isTextLike =
    file &&
    (file.mimeType.startsWith("text/") ||
      file.mimeType === "application/json" ||
      file.mimeType === "application/javascript" ||
      ["txt", "md", "json", "js", "ts", "tsx", "jsx", "py", "sql", "sh", "css", "html", "yml", "yaml", "xml", "csv"].includes(
        file.extension.toLowerCase(),
      ));

  useEffect(() => {
    if (!open || !file || !isTextLike) {
      setTextContent(null);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setTextContent("File exceeds 2MB preview limit. Please download to view.");
      return;
    }

    setLoadingText(true);
    fetch(`/api/files/${file.id}/download?preview=1`)
      .then((res) => res.text())
      .then((txt) => setTextContent(txt))
      .catch((err) => setTextContent(`Failed to load text preview: ${err.message}`))
      .finally(() => setLoadingText(false));
  }, [open, file, isTextLike]);

  if (!file) return null;

  const downloadUrl = `/api/files/${file.id}/download`;
  const streamUrl = `/api/files/${file.id}/download?preview=1`;

  const isImage = file.category === "image" || file.mimeType.startsWith("image/");
  const isVideo = file.category === "video" || file.mimeType.startsWith("video/");
  const isAudio = file.category === "audio" || file.mimeType.startsWith("audio/");
  const isPdf = file.extension.toLowerCase() === "pdf" || file.mimeType === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden border-border/80">
        <div className="flex flex-col max-h-[88vh]">
          {/* Header */}
          <DialogHeader className="p-4 border-b border-border/60 flex flex-row items-center justify-between pr-12">
            <div className="min-w-0 pr-4">
              <DialogTitle className="truncate text-base font-semibold">{file.displayName}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                <span>{formatBytes(file.size)}</span>
                <span>•</span>
                <span>{file.mimeType}</span>
                <span>•</span>
                <span>{new Date(file.createdAt).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
          </DialogHeader>

          {/* Media Body */}
          <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/5 dark:bg-black/30 min-h-[300px] max-h-[62vh]">
            {isImage && (
              <img
                src={streamUrl}
                alt={file.displayName}
                className="max-h-[58vh] max-w-full rounded-lg object-contain shadow-md"
              />
            )}

            {isVideo && (
              <video
                controls
                autoPlay={false}
                playsInline
                className="max-h-[58vh] w-full rounded-lg bg-black shadow-lg"
                src={streamUrl}
              >
                Your browser does not support HTML5 video preview.
              </video>
            )}

            {isAudio && (
              <div className="w-full max-w-md p-6 rounded-2xl bg-card border border-border shadow-sm text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                  <Music className="w-8 h-8" />
                </div>
                <div className="font-medium text-sm mb-1">{file.displayName}</div>
                <div className="text-xs text-muted-foreground mb-4">{formatBytes(file.size)}</div>
                <audio controls className="w-full" src={streamUrl}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

            {isPdf && (
              <iframe
                src={streamUrl}
                title={file.displayName}
                className="w-full h-[58vh] rounded-lg border border-border bg-white"
              />
            )}

            {isTextLike && !isPdf && (
              <div className="w-full h-full min-h-[250px] max-h-[58vh] rounded-lg bg-card border border-border p-4 font-mono text-xs overflow-auto">
                {loadingText ? (
                  <div className="flex items-center justify-center h-48 gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span>Loading preview...</span>
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap break-all leading-relaxed">{textContent}</pre>
                )}
              </div>
            )}

            {!isImage && !isVideo && !isAudio && !isPdf && !isTextLike && (
              <div className="text-center p-8">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground mb-3">
                  <FileIcon className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium mb-1">Direct preview not available for this file type</p>
                <p className="text-xs text-muted-foreground mb-4">
                  You can download the file directly to view it on your device.
                </p>
                <Button asChild size="sm">
                  <a href={downloadUrl} download={file.originalName}>
                    <Download className="w-4 h-4 mr-1.5" /> Download File
                  </a>
                </Button>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3 border-t border-border/60 bg-card flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(file.tags || []).map((t) => (
                <Badge key={t} variant="secondary" className="text-xs">
                  {t}
                </Badge>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={streamUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1" /> Open Tab
                </a>
              </Button>
              {onShare && (
                <Button variant="outline" size="sm" onClick={() => onShare(file.id)}>
                  <Share2 className="w-3.5 h-3.5 mr-1" /> Share
                </Button>
              )}
              <Button asChild size="sm">
                <a href={downloadUrl} download={file.originalName}>
                  <Download className="w-3.5 h-3.5 mr-1" /> Download ({formatBytes(file.size)})
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
