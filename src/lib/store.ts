import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/env";
import { LocalStore, StoredFile, FolderRecord, ShareRecord, ActivityRecord } from "@/lib/types";
import { connectDB } from "@/lib/mongodb";
import { FileModel } from "@/lib/models/File";
import { FolderModel } from "@/lib/models/Folder";
import { ShareModel } from "@/lib/models/Share";
import { ActivityModel } from "@/lib/models/Activity";
import { SettingsModel, SETTINGS_DOC_ID } from "@/lib/models/Settings";

export function stripMongoId<T>(doc: any): T { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!doc) return doc;
  const copy = { ...doc };
  delete copy.__v;
  delete copy._id;
  return copy as T;
}

const defaultSettings = {
  maxFileSize: Number(env.MAX_FILE_SIZE),
  allowedMimeTypes: env.ALLOWED_MIME_TYPES.split(",").map((item) => item.trim()),
  storageQuotaBytes: Number(env.DEFAULT_STORAGE_QUOTA),
  privateLinksOnly: env.PRIVATE_LINKS_ONLY === "true",
  telegramTokens: env.TELEGRAM_BOT_TOKENS
    ? env.TELEGRAM_BOT_TOKENS.split(",").map((t) => t.trim()).filter(Boolean)
    : [env.TELEGRAM_BOT_TOKEN],
  telegramChatId: env.TELEGRAM_STORAGE_CHAT_ID,
  chunkSize: 15 * 1024 * 1024, // 15 MB default for reliable Telegram bot getFile (< 20MB)
};

let didSeed = false;

async function seedFromMetadataJsonIfEmpty() {
  if (didSeed) return;
  didSeed = true;

  try {
    const fileCount = await FileModel.countDocuments();
    if (fileCount > 0) return;

    const metadataPath = path.join(process.cwd(), "data", "metadata.json");
    if (!fs.existsSync(metadataPath)) return;

    const raw = fs.readFileSync(metadataPath, "utf-8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed.files) && parsed.files.length > 0) {
      await FileModel.insertMany(parsed.files);
    }
    if (Array.isArray(parsed.folders) && parsed.folders.length > 0) {
      await FolderModel.insertMany(parsed.folders);
    }
    if (Array.isArray(parsed.shares) && parsed.shares.length > 0) {
      await ShareModel.insertMany(parsed.shares);
    }
    if (Array.isArray(parsed.activity) && parsed.activity.length > 0) {
      await ActivityModel.insertMany(parsed.activity);
    }
    if (parsed.settings) {
      await SettingsModel.findOneAndUpdate(
        { docId: SETTINGS_DOC_ID },
        { $set: { ...parsed.settings, docId: SETTINGS_DOC_ID } },
        { upsert: true },
      );
    }
  } catch (err) {
    console.error("[store] auto-seed from metadata.json failed:", err);
  }
}

async function ensureSettings() {
  await SettingsModel.findOneAndUpdate(
    { docId: SETTINGS_DOC_ID },
    { $setOnInsert: { docId: SETTINGS_DOC_ID, ...defaultSettings } },
    { upsert: true, returnDocument: "after" },
  );
}

export async function readStore(): Promise<LocalStore> {
  await connectDB();
  await ensureSettings();
  await seedFromMetadataJsonIfEmpty();

  const [files, folders, shares, activity, settingsDoc] = await Promise.all([
    FileModel.find({}).sort({ createdAt: -1 }).lean(),
    FolderModel.find({}).lean(),
    ShareModel.find({}).sort({ createdAt: -1 }).lean(),
    ActivityModel.find({}).sort({ createdAt: -1 }).limit(300).lean(),
    SettingsModel.findOne({ docId: SETTINGS_DOC_ID }).lean(),
  ]);

  const settings = settingsDoc
    ? {
        maxFileSize: settingsDoc.maxFileSize ?? defaultSettings.maxFileSize,
        allowedMimeTypes: settingsDoc.allowedMimeTypes ?? defaultSettings.allowedMimeTypes,
        storageQuotaBytes: settingsDoc.storageQuotaBytes ?? defaultSettings.storageQuotaBytes,
        privateLinksOnly: settingsDoc.privateLinksOnly ?? defaultSettings.privateLinksOnly,
        telegramTokens:
          settingsDoc.telegramTokens && settingsDoc.telegramTokens.length > 0
            ? settingsDoc.telegramTokens
            : defaultSettings.telegramTokens,
        telegramChatId: settingsDoc.telegramChatId ?? defaultSettings.telegramChatId,
        chunkSize: settingsDoc.chunkSize ?? defaultSettings.chunkSize,
      }
    : defaultSettings;

  return {
    files: files.map((d) => stripMongoId<StoredFile>(d)),
    folders: folders.map((d) => stripMongoId<FolderRecord>(d)),
    shares: shares.map((d) => stripMongoId<ShareRecord>(d)),
    activity: activity.map((d) => stripMongoId<ActivityRecord>(d)),
    settings,
  };
}

export async function writeStore(store: LocalStore): Promise<void> {
  await connectDB();
  await SettingsModel.findOneAndUpdate(
    { docId: SETTINGS_DOC_ID },
    { ...store.settings, docId: SETTINGS_DOC_ID },
    { upsert: true, returnDocument: "after" },
  );
}

export async function mutateStore<T>(
  mutator: (store: LocalStore) => Promise<T> | T,
): Promise<T> {
  await connectDB();
  const store = await readStore();
  const before = snapshot(store);
  const result = await mutator(store);
  const after = snapshot(store);

  await persistDiff(before, after);
  return result;
}

function snapshot(store: LocalStore) {
  return JSON.stringify({
    files: store.files,
    folders: store.folders,
    shares: store.shares,
    activity: store.activity,
    settings: store.settings,
  });
}

async function persistDiff(before: string, after: string): Promise<void> {
  if (before === after) return;

  const b = JSON.parse(before) as LocalStore;
  const a = JSON.parse(after) as LocalStore;

  const ops: Promise<unknown>[] = [];

  // Files
  const beforeFileIds = new Set(b.files.map((f) => f.id));
  const afterFileIds = new Set(a.files.map((f) => f.id));

  for (const file of a.files) {
    const unchanged = b.files.find(
      (f) => f.id === file.id && JSON.stringify(f) === JSON.stringify(file),
    );
    if (!unchanged) {
      ops.push(
        FileModel.findOneAndUpdate({ id: file.id }, file, {
          upsert: true,
          returnDocument: "after",
        }),
      );
    }
  }
  for (const id of beforeFileIds) {
    if (!afterFileIds.has(id)) {
      ops.push(FileModel.deleteOne({ id }));
    }
  }

  // Folders
  const beforeFolderIds = new Set(b.folders.map((f) => f.id));
  const afterFolderIds = new Set(a.folders.map((f) => f.id));

  for (const folder of a.folders) {
    const unchanged = b.folders.find(
      (f) => f.id === folder.id && JSON.stringify(f) === JSON.stringify(folder),
    );
    if (!unchanged) {
      ops.push(
        FolderModel.findOneAndUpdate({ id: folder.id }, folder, {
          upsert: true,
          returnDocument: "after",
        }),
      );
    }
  }
  for (const id of beforeFolderIds) {
    if (!afterFolderIds.has(id)) {
      ops.push(FolderModel.deleteOne({ id }));
    }
  }

  // Shares
  const beforeShareIds = new Set(b.shares.map((s) => s.id));
  const afterShareIds = new Set(a.shares.map((s) => s.id));

  for (const share of a.shares) {
    const unchanged = b.shares.find(
      (s) => s.id === share.id && JSON.stringify(s) === JSON.stringify(share),
    );
    if (!unchanged) {
      ops.push(
        ShareModel.findOneAndUpdate({ id: share.id }, share, {
          upsert: true,
          returnDocument: "after",
        }),
      );
    }
  }
  for (const id of beforeShareIds) {
    if (!afterShareIds.has(id)) {
      ops.push(ShareModel.deleteOne({ id }));
    }
  }

  // Activity
  const beforeActivityIds = new Set(b.activity.map((a) => a.id));
  for (const entry of a.activity) {
    if (!beforeActivityIds.has(entry.id)) {
      ops.push(ActivityModel.create(entry).catch(() => null));
    }
  }
  if (a.activity.length < b.activity.length) {
    const keepIds = new Set(a.activity.map((x) => x.id));
    const toDelete = b.activity.filter((x) => !keepIds.has(x.id)).map((x) => x.id);
    if (toDelete.length) {
      ops.push(ActivityModel.deleteMany({ id: { $in: toDelete } }));
    }
  }

  // Settings
  if (JSON.stringify(b.settings) !== JSON.stringify(a.settings)) {
    ops.push(
      SettingsModel.findOneAndUpdate(
        { docId: SETTINGS_DOC_ID },
        { ...a.settings, docId: SETTINGS_DOC_ID },
        { upsert: true, returnDocument: "after" },
      ),
    );
  }

  await Promise.all(ops);
}
