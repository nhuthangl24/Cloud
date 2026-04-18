export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "other";

export type FileChunk = {
  index: number;
  telegramFileId: string;
  telegramMessageId: number;
  telegramChatId: string;
  size: number;
};

export type ActivityAction =
  | "UPLOAD"
  | "DOWNLOAD"
  | "DELETE_SOFT"
  | "DELETE_HARD"
  | "FOLDER_CREATE"
  | "FOLDER_DELETE"
  | "SHARE_CREATE"
  | "SHARE_REVOKE"
  | "SETTINGS_UPDATE"
  | "TELEGRAM_ERROR";

export type StoredFile = {
  id: string;
  originalName: string;
  displayName: string;
  description: string;
  mimeType: string;
  extension: string;
  size: number;
  category: FileCategory;
  sha256: string;
  telegramFileId: string;
  telegramUniqueFileId?: string;
  telegramMessageId: number;
  telegramChatId: string;
  folderId: string | null;
  tags: string[];
  isChunked: boolean;
  chunks: FileChunk[];
  isDeleted: boolean;
  deletedAt: string | null;
  downloadCount: number;
  lastDownloadedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FolderRecord = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  path: string;
  createdAt: string;
};

export type ShareRecord = {
  id: string;
  fileId: string;
  token: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  password: string | null;
  createdAt: string;
};

export type ActivityRecord = {
  id: string;
  action: ActivityAction;
  status: "SUCCESS" | "ERROR";
  message: string;
  fileId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type AppSettings = {
  maxFileSize: number;
  allowedMimeTypes: string[];
  storageQuotaBytes: number;
  privateLinksOnly: boolean;
  telegramTokens: string[];
  telegramChatId: string;
  chunkSize: number;
};

export type LocalStore = {
  files: StoredFile[];
  folders: FolderRecord[];
  shares: ShareRecord[];
  activity: ActivityRecord[];
  settings: AppSettings;
};
