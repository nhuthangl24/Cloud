"use client";

import Link from "next/link";
import { Download, Eye, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CreateShareButton } from "@/components/create-share-button";
import { DeleteFileButton } from "@/components/delete-file-button";
import { formatBytes } from "@/lib/utils";
import { useUpload } from "@/components/providers/upload-provider";

type FileTableProps = {
  files: Array<{
    id: string;
    displayName: string;
    originalName: string;
    size: number;
    mimeType: string;
    category: string;
    downloadCount: number;
    createdAt: string;
    isDeleted?: boolean;
    tags?: string[];
  }>;
  title?: string;
};

export function FileTable({ files, title = "Files" }: FileTableProps) {
  const { items } = useUpload();

  const activeUploads = items.filter(
    (i) => i.status === "uploading" || i.status === "queued" || i.status === "error"
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border/70">
              <th className="pb-3 font-medium">Name</th>
              <th className="pb-3 font-medium">Type</th>
              <th className="pb-3 font-medium">Size</th>
              <th className="pb-3 font-medium">Tags</th>
              <th className="pb-3 font-medium">Status / Progress</th>
              <th className="pb-3 font-medium">Uploaded</th>
              <th className="pb-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeUploads.map((item) => (
              <tr key={item.id} className="border-b border-border/50 bg-primary/5">
                <td className="py-4">
                  <div className="font-medium text-muted-foreground">{item.name}</div>
                  <div className="text-xs text-muted-foreground italic">
                    {item.status === 'queued' ? 'In queue...' : item.statusText}
                  </div>
                </td>
                <td className="py-4">
                  <Badge variant="secondary" className="opacity-70">
                    {item.status === "error" ? "Failed" : "Uploading..."}
                  </Badge>
                </td>
                <td className="py-4 text-muted-foreground">{formatBytes(item.size)}</td>
                <td className="py-4">
                  <Badge variant="outline" className="opacity-50 border-dashed">
                    pending
                  </Badge>
                </td>
                <td className="py-4">
                  {item.status !== "error" ? (
                    <div className="flex items-center gap-2">
                       <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                       <Progress value={item.progress} className="w-[80px] h-2" />
                       <span className="text-xs">{item.progress}%</span>
                    </div>
                  ) : (
                    <span className="text-xs text-destructive">{item.error || 'Failed'}</span>
                  )}
                </td>
                <td className="py-4 text-muted-foreground font-mono text-xs">Now</td>
                <td className="py-4 text-right">
                  <span className="text-xs text-muted-foreground italic mr-2">
                     Background task
                  </span>
                </td>
              </tr>
            ))}

            {files.map((file) => (
              <tr key={file.id} className="border-b border-border/50 last:border-b-0">
                <td className="py-4">
                  <div className="font-medium">{file.displayName}</div>
                  <div className="text-xs text-muted-foreground">{file.originalName}</div>
                </td>
                <td className="py-4">
                  <Badge>{file.category}</Badge>
                </td>
                <td className="py-4">{formatBytes(file.size)}</td>
                <td className="py-4">
                  <div className="flex flex-wrap gap-1">
                    {(file.tags || []).slice(0, 2).map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                </td>
                <td className="py-4">{file.downloadCount} dl(s)</td>
                <td className="py-4" suppressHydrationWarning>{new Date(file.createdAt).toLocaleDateString("vi-VN")}</td>
                <td className="py-4">
                  <div className="flex justify-end gap-2">
                    <Button asChild size="icon" variant="outline">
                      <Link href={`/dashboard/files/${file.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="icon" variant="outline">
                      <a href={`/api/files/${file.id}/download`}>
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    <CreateShareButton fileId={file.id} />
                    <DeleteFileButton fileId={file.id} />
                  </div>
                </td>
              </tr>
            ))}

            {activeUploads.length === 0 && files.length === 0 && (
              <tr>
                <td colSpan={7} className="py-4 text-center text-muted-foreground">
                  No files found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
