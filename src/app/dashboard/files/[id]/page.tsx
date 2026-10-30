/* eslint-disable @next/next/no-img-element */
import { Download, MessageSquare, ExternalLink, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateShareButton } from "@/components/create-share-button";
import { DeleteFileButton } from "@/components/delete-file-button";
import { getFileByIdForUser } from "@/server/services/file.service";
import { formatBytes } from "@/lib/utils";

export default async function FileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const file = await getFileByIdForUser(id);

  const isImage = file.category === "image" || file.mimeType.startsWith("image/");
  const isVideo = file.category === "video" || file.mimeType.startsWith("video/");
  const isAudio = file.category === "audio" || file.mimeType.startsWith("audio/");
  const isPdf = file.extension.toLowerCase() === "pdf" || file.mimeType === "application/pdf";
  const previewUrl = `/api/files/${file.id}/download?preview=1`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/files"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Files
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{file.displayName}</h1>
          <p className="text-sm text-muted-foreground">{file.originalName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-4 w-4" />
              Preview Tab
            </a>
          </Button>
          <Button asChild>
            <a href={`/api/files/${file.id}/download`} download={file.originalName}>
              <Download className="mr-1.5 h-4 w-4" />
              Download ({formatBytes(file.size)})
            </a>
          </Button>
          <CreateShareButton fileId={file.id} />
        </div>
      </div>

      {/* Media Preview Box */}
      {(isImage || isVideo || isAudio || isPdf) && (
        <Card className="overflow-hidden border-border/80">
          <CardHeader className="py-3 px-4 border-b border-border/60 bg-muted/20">
            <CardTitle className="text-sm font-medium">Media Preview</CardTitle>
          </CardHeader>
          <CardContent className="p-4 flex items-center justify-center bg-black/5 dark:bg-black/30 min-h-[240px]">
            {isImage && (
              <img
                src={previewUrl}
                alt={file.displayName}
                className="max-h-[480px] max-w-full rounded-xl object-contain shadow"
              />
            )}
            {isVideo && (
              <video
                controls
                playsInline
                className="max-h-[480px] w-full max-w-3xl rounded-xl bg-black shadow"
                src={previewUrl}
              >
                Your browser does not support HTML5 video streaming.
              </video>
            )}
            {isAudio && (
              <div className="w-full max-w-md p-6 bg-card rounded-2xl border border-border text-center shadow-sm">
                <audio controls className="w-full mt-2" src={previewUrl}>
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}
            {isPdf && (
              <iframe
                src={previewUrl}
                title={file.displayName}
                className="w-full h-[520px] rounded-xl border border-border bg-white"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Metadata & Telegram Info */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">File Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Meta label="Original Name" value={file.originalName} />
            <Meta label="Display Name" value={file.displayName} />
            <Meta label="Size" value={formatBytes(file.size)} />
            <Meta label="MIME Type" value={file.mimeType} />
            <Meta label="Uploaded At" value={new Date(file.createdAt).toLocaleString("vi-VN")} />
            <Meta label="Last Downloaded" value={file.lastDownloadedAt ? new Date(file.lastDownloadedAt).toLocaleString("vi-VN") : "Never"} />
            <Meta label="Download Count" value={`${file.downloadCount} times`} />
            <Meta label="Storage Type" value={file.isChunked ? `Chunked (${file.chunks?.length || 0} chunks)` : "Single document"} />
            <Meta label="SHA-256 Hash" value={file.sha256 || "-"} />
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Telegram Storage Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-secondary/60 p-4 border border-border/50">
              <div className="flex items-center gap-2 font-medium text-sm">
                <MessageSquare className="h-4 w-4 text-primary" />
                Telegram File Mapping
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                File is secured and stored on Telegram cloud. The internal file ID is securely routed through our streaming backend.
              </p>
              <div className="mt-3 space-y-1 text-xs font-mono">
                <div><span className="text-muted-foreground">Message ID:</span> {file.telegramMessageId}</div>
                <div className="break-all"><span className="text-muted-foreground">File ID:</span> {file.telegramFileId}</div>
                <div><span className="text-muted-foreground">Chat ID:</span> {file.telegramChatId}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(file.tags || []).map((tag) => (
                <Badge key={tag} variant="secondary">{tag}</Badge>
              ))}
            </div>

            <div className="pt-2">
              <DeleteFileButton fileId={file.id} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-all font-medium text-xs sm:text-sm">{value}</div>
    </div>
  );
}
