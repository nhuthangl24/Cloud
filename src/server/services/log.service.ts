import { randomUUID } from "node:crypto";
import { ActivityAction } from "@/lib/types";
import { mutateStore } from "@/lib/store";

export async function createLog(input: {
  action: ActivityAction;
  status: "SUCCESS" | "ERROR";
  message: string;
  fileId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await mutateStore((store) => {
    store.activity.unshift({
      id: randomUUID(),
      action: input.action,
      status: input.status,
      message: input.message,
      fileId: input.fileId ?? null,
      metadata: input.metadata ?? {},
      createdAt: new Date().toISOString(),
    });

    store.activity = store.activity.slice(0, 300);
  });
}

export async function clearLogs() {
  return mutateStore((store) => {
    store.activity = [];
    return { cleared: true };
  });
}
