import Link from "next/link";
import { Download, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateShareButton } from "@/components/create-share-button";
import { DeleteFileButton } from "@/components/delete-file-button";
import { formatBytes } from "@/lib/utils";

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
              <th className="pb-3 font-medium">Downloads</th>
              <th className="pb-3 font-medium">Uploaded</th>
              <th className="pb-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
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
                <td className="py-4">{file.downloadCount}</td>
                <td className="py-4">{new Date(file.createdAt).toLocaleDateString()}</td>
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
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
