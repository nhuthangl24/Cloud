import { Download, MessageSquare } from "lucide-react";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">{file.displayName}</h1>
          <p className="mt-2 text-muted-foreground">{file.originalName}</p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <a href={`/api/files/${file.id}/download`}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </a>
          </Button>
          <CreateShareButton fileId={file.id} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>File Metadata</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Meta label="Original Name" value={file.originalName} />
            <Meta label="Display Name" value={file.displayName} />
            <Meta label="Size" value={formatBytes(file.size)} />
            <Meta label="Mime Type" value={file.mimeType} />
            <Meta label="Uploaded" value={new Date(file.createdAt).toLocaleString()} />
            <Meta label="Telegram Message ID" value={String(file.telegramMessageId)} />
            <Meta label="Telegram File ID" value={file.telegramFileId} />
            <Meta label="Telegram Chat ID" value={file.telegramChatId} />
            <Meta label="Downloads" value={String(file.downloadCount)} />
            <Meta label="Hash" value={file.sha256 || "-"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Telegram Mapping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl bg-secondary/60 p-4">
              <div className="flex items-center gap-2 font-medium">
                <MessageSquare className="h-4 w-4 text-primary" />
                Stored in Telegram
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                This record maps directly to one Telegram message and one Telegram file identifier.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(file.tags || []).map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
            <DeleteFileButton fileId={file.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/70 p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 break-all font-medium">{value}</div>
    </div>
  );
}
