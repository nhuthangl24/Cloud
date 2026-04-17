import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFileByShareToken } from "@/server/services/file.service";
import { formatBytes } from "@/lib/utils";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const resolved = await getFileByShareToken(token);

  if (!resolved) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <Card className="w-full max-w-lg">
          <CardContent className="p-10 text-center">Share link not found.</CardContent>
        </Card>
      </main>
    );
  }

  const { file } = resolved;

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>{file.displayName}</CardTitle>
          <CardDescription>Telegram-backed download link</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-2xl bg-secondary/70 p-4">
              <div className="text-muted-foreground">Type</div>
              <div className="mt-1 font-medium">{file.mimeType}</div>
            </div>
            <div className="rounded-2xl bg-secondary/70 p-4">
              <div className="text-muted-foreground">Size</div>
              <div className="mt-1 font-medium">{formatBytes(file.size)}</div>
            </div>
          </div>
          <Button asChild className="w-full">
            <a href={`/api/public/${token}`}>Download</a>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
