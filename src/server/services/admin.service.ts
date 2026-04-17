import { isToday, subDays } from "date-fns";
import { readStore } from "@/lib/store";
import { calculateUsedBytes } from "@/server/services/quota.service";

export async function getDashboardStats() {
  const store = await readStore();
  const activeFiles = store.files.filter((file) => !file.isDeleted);
  const uploadLogs = store.activity.filter((item) => item.action === "UPLOAD");

  return {
    totalFiles: activeFiles.length,
    totalUsageBytes: calculateUsedBytes(store.files),
    uploadsToday: uploadLogs.filter((item) => isToday(new Date(item.createdAt))).length,
    uploadErrorsToday: store.activity.filter(
      (item) => item.status === "ERROR" && isToday(new Date(item.createdAt)),
    ).length,
    uploadsLast7Days: Array.from({ length: 7 }).map((_, index) => {
      const day = subDays(new Date(), 6 - index);
      return {
        label: day.toLocaleDateString("vi-VN", { month: "2-digit", day: "2-digit" }),
        count: uploadLogs.filter((item) => {
          const created = new Date(item.createdAt);
          return created.toDateString() === day.toDateString();
        }).length,
      };
    }),
  };
}
