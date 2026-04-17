import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TelegramTestButton } from "@/components/telegram-test-button";
import { telegramHealthCheck } from "@/server/services/telegram.service";

export default async function TelegramPage() {
  const health = await telegramHealthCheck().catch(() => null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Telegram</h1>
        <p className="mt-2 text-muted-foreground">
          Kiểm tra nhanh bot token và storage chat hiện tại.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Health Check</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>Status: {health?.ok ? "Healthy" : "Unavailable"}</div>
          <div>Bot Username: {health?.username || "-"}</div>
          <div>Storage Chat ID: {health?.storageChatId || "-"}</div>
          <div className="pt-2">
            <TelegramTestButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
