import { env } from "@/lib/env";
import { LocalStore, StoredFile, FolderRecord, ShareRecord, ActivityRecord } from "@/lib/types";
import { connectDB } from "@/lib/mongodb";
import { FileModel } from "@/lib/models/File";
import { FolderModel } from "@/lib/models/Folder";
import { ShareModel } from "@/lib/models/Share";
import { ActivityModel } from "@/lib/models/Activity";
import { SettingsModel, SETTINGS_DOC_ID } from "@/lib/models/Settings";

const defaultSettings = {
  maxFileSize: Number(env.MAX_FILE_SIZE),
  allowedMimeTypes: env.ALLOWED_MIME_TYPES.split(",").map((item) => item.trim()),
  storageQuotaBytes: Number(env.DEFAULT_STORAGE_QUOTA),
  privateLinksOnly: env.PRIVATE_LINKS_ONLY === "true",
};

async function ensureSettings() {
  await SettingsModel.findOneAndUpdate(
    { docId: SETTINGS_DOC_ID },
    { $setOnInsert: { docId: SETTINGS_DOC_ID, ...defaultSettings } },
    { upsert: true, returnDocument: 'after' },
  );
}

export async function readStore(): Promise<LocalStore> {
  await connectDB();
  await ensureSettings();

  const [files, folders, shares, activity, settingsDoc] = await Promise.all([
    FileModel.find({}).sort({ createdAt: -1 }).lean(),
    FolderModel.find({}).lean(),
    ShareModel.find({}).sort({ createdAt: -1 }).lean(),
    ActivityModel.find({}).sort({ createdAt: -1 }).limit(300).lean(),
    SettingsModel.findOne({ docId: SETTINGS_DOC_ID }).lean(),
  ]);

  const settings = settingsDoc
    ? {
        maxFileSize: settingsDoc.maxFileSize,
        allowedMimeTypes: settingsDoc.allowedMimeTypes,
        storageQuotaBytes: settingsDoc.storageQuotaBytes,
        privateLinksOnly: settingsDoc.privateLinksOnly,
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

// writeStore is kept for API compatibility but most mutations go through
// individual model operations. It syncs settings only; documents are written
// directly in mutateStore.
export async function writeStore(store: LocalStore): Promise<void> {
  await connectDB();
  await SettingsModel.findOneAndUpdate(
    { docId: SETTINGS_DOC_ID },
    { ...store.settings, docId: SETTINGS_DOC_ID },
    { upsert: true, returnDocument: 'after' },
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

  // Diff and persist only what changed
  await persistDiff(before, after);

  return result;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function stripMongoId<T>(doc: any): T {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { __v, _id, ...rest } = doc;
  return rest as unknown as T;
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

async function persistDiff(
  before: string,
  after: string,
): Promise<void> {
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
          returnDocument: 'after',
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
          returnDocument: 'after',
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
          returnDocument: 'after',
        }),
      );
    }
  }
  for (const id of beforeShareIds) {
    if (!afterShareIds.has(id)) {
      ops.push(ShareModel.deleteOne({ id }));
    }
  }

  // Activity — only add new entries (oldest are trimmed in log.service)
  const beforeActivityIds = new Set(b.activity.map((a) => a.id));
  for (const entry of a.activity) {
    if (!beforeActivityIds.has(entry.id)) {
      ops.push(ActivityModel.create(entry).catch(() => null)); // ignore dup key
    }
  }
  // Trim excess in DB if the service sliced the array
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
        { upsert: true, returnDocument: 'after' },
      ),
    );
  }

  await Promise.all(ops);
}
