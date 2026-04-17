import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityActions } from "@/components/activity-actions";
import { StatusBadge } from "@/components/status-badge";
import { readStore } from "@/lib/store";

export default async function ActivityPage() {
  const store = await readStore();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Activity</h1>
        <p className="mt-2 text-muted-foreground">
          Upload, download, delete và lỗi Telegram gần đây.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Events</CardTitle>
          <ActivityActions />
        </CardHeader>
        <CardContent className="space-y-3">
          {store.activity.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-8 text-sm text-muted-foreground">
              No activity yet.
            </div>
          ) : null}
          {store.activity.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border/70 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="font-medium">{item.action}</div>
                  <StatusBadge tone={item.status === "SUCCESS" ? "success" : "error"}>
                    {item.status}
                  </StatusBadge>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(item.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{item.message}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
