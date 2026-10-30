import { Card, CardContent } from "@/components/ui/card";
import { getFileByShareToken } from "@/server/services/file.service";
import { PublicShareView } from "@/components/public-share-view";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await getFileByShareToken(token);

  if (!resolved) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-muted/20">
        <Card className="w-full max-w-md border-border/80 shadow-xl">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Share link not found or file has been deleted.
          </CardContent>
        </Card>
      </main>
    );
  }

  const { share, file } = resolved;
  const isExpired = Boolean(share.expiresAt && new Date(share.expiresAt) < new Date());
  const isLimitReached = Boolean(share.maxDownloads && share.downloadCount >= share.maxDownloads);

  return (
    <main className="flex min-h-screen items-center justify-center p-4 md:p-8 bg-muted/20">
      <PublicShareView
        token={token}
        file={{
          id: file.id,
          displayName: file.displayName,
          originalName: file.originalName,
          size: file.size,
          mimeType: file.mimeType,
          category: file.category,
          extension: file.extension || file.originalName.split(".").pop() || "",
        }}
        hasPassword={Boolean(share.password)}
        expiresAt={share.expiresAt}
        downloadCount={share.downloadCount}
        maxDownloads={share.maxDownloads}
        isExpired={isExpired}
        isLimitReached={isLimitReached}
      />
    </main>
  );
}
