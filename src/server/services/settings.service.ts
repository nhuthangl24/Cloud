import { mutateStore, readStore } from "@/lib/store";
import { AppSettings } from "@/lib/types";
import { createLog } from "@/server/services/log.service";

export async function getSystemSettings() {
  const store = await readStore();
  return store.settings;
}

export async function updateSystemSettings(partial: Partial<AppSettings>) {
  const settings = await mutateStore((store) => {
    store.settings = {
      ...store.settings,
      ...partial,
    };
    return store.settings;
  });

  await createLog({
    action: "SETTINGS_UPDATE",
    status: "SUCCESS",
    message: "Updated dashboard settings",
    metadata: partial,
  });

  return settings;
}
