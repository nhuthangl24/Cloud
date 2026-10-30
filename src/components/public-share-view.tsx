/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import { Download, Lock, ExternalLink, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/utils";

type PublicShareViewProps = {
  token: string;
  file: {
    id: string;
    displayName: string;
    originalName: string;
    size: number;
    mimeType: string;
    category: string;
    extension: string;
  };
  hasPassword: boolean;
  expiresAt: string | null;
  downloadCount: number;
  maxDownloads: number | null;
  isExpired: boolean;
  isLimitReached: boolean;
};

export function PublicShareView({
  token,
  file,
  hasPassword,
  expiresAt,
  downloadCount,
  maxDownloads,
  isExpired,
  isLimitReached,
}: PublicShareViewProps) {
  const [password, setPassword] = useState("");

  const downloadUrl = password
    ? `/api/public/${token}?password=${encodeURIComponent(password)}`
    : `/api/public/${token}`;

  const previewUrl = password
    ? `/api/public/${token}?preview=1&password=${encodeURIComponent(password)}`
    : `/api/public/${token}?preview=1`;

  const isImage = file.category === "image" || file.mimeType.startsWith("image/");
  const isVideo = file.category === "video" || file.mimeType.startsWith("video/");
  const isAudio = file.category === "audio" || file.mimeType.startsWith("audio/");
  const isPdf = file.extension.toLowerCase() === "pdf" || file.mimeType === "application/pdf";

  if (isExpired) {
    return (
      <Card className="w-full max-w-md border-destructive/40 shadow-xl">
        <CardContent className="p-8 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold">Share Link Expired</h2>
          <p className="text-xs text-muted-foreground">This download link has expired and is no longer available.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLimitReached) {
    return (
      <Card className="w-full max-w-md border-amber-500/40 shadow-xl">
        <CardContent className="p-8 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold">Download Limit Reached</h2>
          <p className="text-xs text-muted-foreground">This link has reached its maximum download allowance ({maxDownloads} downloads).</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-xl border-border/80 shadow-2xl backdrop-blur-md overflow-hidden">
      <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs uppercase tracking-wider text-muted-foreground">
            Shared File
          </Badge>
          {maxDownloads && (
            <span className="text-xs text-muted-foreground font-mono">
              {downloadCount} / {maxDownloads} downloads
            </span>
          )}
        </div>
        <CardTitle className="text-xl font-bold truncate mt-2">{file.displayName}</CardTitle>
        <CardDescription className="text-xs truncate">{file.originalName}</CardDescription>
      </CardHeader>

      <CardContent className="p-6 space-y-5">
        {/* Media Preview Box if no password required or if image */}
        {!hasPassword && (isImage || isVideo || isAudio) && (
          <div className="rounded-xl overflow-hidden bg-black/5 dark:bg-black/30 border border-border/60 p-2 flex items-center justify-center max-h-[300px]">
            {isImage && (
              <img
                src={previewUrl}
                alt={file.displayName}
                className="max-h-[280px] w-auto rounded-lg object-contain shadow"
              />
            )}
            {isVideo && (
              <video
                controls
                playsInline
                className="max-h-[280px] w-full rounded-lg bg-black"
                src={previewUrl}
              />
            )}
            {isAudio && (
              <audio controls className="w-full my-4" src={previewUrl} />
            )}
          </div>
        )}

        {/* Metadata info */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-border/60 bg-secondary/50 p-3">
            <div className="text-muted-foreground">Size</div>
            <div className="mt-1 font-semibold text-sm">{formatBytes(file.size)}</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-secondary/50 p-3">
            <div className="text-muted-foreground">Type</div>
            <div className="mt-1 font-semibold text-sm truncate">{file.mimeType}</div>
          </div>
        </div>

        {/* Password input if protected */}
        {hasPassword && (
          <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-500">
              <Lock className="h-3.5 w-3.5" />
              Password Protected File
            </div>
            <p className="text-xs text-muted-foreground">This shared link requires a password to access.</p>
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 text-sm"
            />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2">
          {!hasPassword && isPdf && (
            <Button asChild variant="outline" className="flex-1">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Preview
              </a>
            </Button>
          )}
          <Button asChild className="flex-1 shadow-md">
            <a href={downloadUrl} download={file.originalName}>
              <Download className="mr-2 h-4 w-4" /> Download ({formatBytes(file.size)})
            </a>
          </Button>
        </div>

        {expiresAt && (
          <div className="text-center text-[11px] text-muted-foreground">
            Expires on: {new Date(expiresAt).toLocaleString("vi-VN")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
