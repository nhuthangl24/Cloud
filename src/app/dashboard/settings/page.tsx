import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/settings-form";
import { formatBytes } from "@/lib/utils";
import { getSystemSettings } from "@/server/services/settings.service";

export default async function SettingsPage() {
  const settings = await getSystemSettings();

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Runtime</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>Mode: Single-user private dashboard</div>
            <div>Allowed MIME: {settings.allowedMimeTypes.join(", ")}</div>
            <div>
              Private links only: {settings.privateLinksOnly ? "Yes" : "No"}
            </div>
            <div>App storage quota: 5 TB default</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quota</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>Max file size: {formatBytes(settings.maxFileSize)}</div>
            <div>
              Total storage budget: {formatBytes(settings.storageQuotaBytes)}
            </div>
            <div className="text-muted-foreground">
              Note: this is the app quota. Actual per-file upload size still
              depends on the Telegram Bot API flow you are using.
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Edit Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <SettingsForm initial={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
