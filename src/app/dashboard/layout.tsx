import { AppShell } from "@/components/app-shell";
import { requireServerSession } from "@/lib/auth";
import { readStore } from "@/lib/store";
import { calculateUsedBytes } from "@/server/services/quota.service";
import { UploadProvider } from "@/components/providers/upload-provider";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireServerSession();
  const store = await readStore();

  return (
    <AppShell
      username={session.username}
      stats={{
        quotaBytes: store.settings.storageQuotaBytes,
        usedBytes: calculateUsedBytes(store.files),
      }}
    >
      <UploadProvider>
        {children}
      </UploadProvider>
    </AppShell>
  );
}
