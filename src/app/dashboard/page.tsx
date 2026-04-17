import { Activity, Files, HardDrive, Upload } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { UploadModal } from "@/components/upload-modal";
import { UploadsChart } from "@/components/uploads-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readStore } from "@/lib/store";
import { getDashboardStats } from "@/server/services/admin.service";
import { formatBytes } from "@/lib/utils";

export default async function DashboardPage() {
  const [store, stats] = await Promise.all([readStore(), getDashboardStats()]);
  const recentUploads = store.files.filter((file) => !file.isDeleted).slice(0, 5);
  const recentLogs = store.activity.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Quản lý file lưu trên Telegram với metadata, quota và audit log.
          </p>
        </div>
        <UploadModal />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Files" value={String(stats.totalFiles)} icon={Files} />
        <StatCard label="Storage Used" value={formatBytes(stats.totalUsageBytes)} icon={HardDrive} />
        <StatCard label="Quota" value={formatBytes(store.settings.storageQuotaBytes)} icon={Upload} />
        <StatCard label="Activity Logs" value={String(recentLogs.length)} icon={Activity} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader>
            <CardTitle>Upload Activity</CardTitle>
            <CardDescription>Uploads over the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent>
            <UploadsChart data={stats.uploadsLast7Days} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Uploads</CardTitle>
            <CardDescription>Latest files mapped to Telegram storage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentUploads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
                Chưa có file nào được upload. Dữ liệu 7 ngày gần nhất sẽ hiện ở biểu đồ bên trái ngay khi
                bạn bắt đầu dùng storage.
              </div>
            ) : (
              recentUploads.map((file) => (
                <div key={file.id} className="rounded-2xl bg-secondary/60 p-4">
                  <div className="text-sm font-medium">{file.displayName}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{file.mimeType}</div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
