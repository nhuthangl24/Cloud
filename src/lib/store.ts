import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { LocalStore } from "@/lib/types";
import { pick } from "@/lib/utils";

const storeDir = path.join(process.cwd(), "data");
const storePath = path.join(storeDir, "metadata.json");

const defaultStore: LocalStore = {
  files: [],
  folders: [],
  shares: [],
  activity: [],
  settings: {
    maxFileSize: Number(env.MAX_FILE_SIZE),
    allowedMimeTypes: env.ALLOWED_MIME_TYPES.split(",").map((item) => item.trim()),
    storageQuotaBytes: Number(env.DEFAULT_STORAGE_QUOTA),
    privateLinksOnly: env.PRIVATE_LINKS_ONLY === "true",
  },
};

async function ensureStoreFile() {
  await mkdir(storeDir, { recursive: true });
  try {
    await readFile(storePath, "utf8");
  } catch {
    await writeFile(storePath, JSON.stringify(defaultStore, null, 2), "utf8");
  }
}

export async function readStore() {
  await ensureStoreFile();
  const raw = await readFile(storePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<LocalStore>;

  const normalized: LocalStore = {
    files: Array.isArray(parsed.files) ? parsed.files : defaultStore.files,
    folders: Array.isArray(parsed.folders) ? parsed.folders : defaultStore.folders,
    shares: Array.isArray(parsed.shares) ? parsed.shares : defaultStore.shares,
    activity: Array.isArray(parsed.activity) ? parsed.activity : defaultStore.activity,
    settings: {
      maxFileSize:
        typeof parsed.settings?.maxFileSize === "number" &&
        Number.isFinite(parsed.settings.maxFileSize)
          ? parsed.settings.maxFileSize
          : defaultStore.settings.maxFileSize,
      allowedMimeTypes:
        Array.isArray(parsed.settings?.allowedMimeTypes) &&
        parsed.settings.allowedMimeTypes.length > 0
          ? parsed.settings.allowedMimeTypes
          : defaultStore.settings.allowedMimeTypes,
      storageQuotaBytes:
        typeof parsed.settings?.storageQuotaBytes === "number" &&
        Number.isFinite(parsed.settings.storageQuotaBytes) &&
        parsed.settings.storageQuotaBytes > 0
          ? parsed.settings.storageQuotaBytes
          : defaultStore.settings.storageQuotaBytes,
      privateLinksOnly: pick(
        typeof parsed.settings?.privateLinksOnly === "boolean"
          ? parsed.settings.privateLinksOnly
          : undefined,
        defaultStore.settings.privateLinksOnly,
      ),
    },
  };

  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await writeStore(normalized);
  }

  return normalized;
}

export async function writeStore(store: LocalStore) {
  await ensureStoreFile();
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function mutateStore<T>(
  mutator: (store: LocalStore) => Promise<T> | T,
) {
  const store = await readStore();
  const result = await mutator(store);
  await writeStore(store);
  return result;
}
