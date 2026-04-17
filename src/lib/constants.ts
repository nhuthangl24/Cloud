export const FILE_CATEGORIES = [
  "image",
  "video",
  "audio",
  "document",
  "archive",
  "other",
] as const;

export const ACTION_TYPES = [
  "UPLOAD",
  "DOWNLOAD",
  "DELETE_SOFT",
  "DELETE_HARD",
  "FOLDER_CREATE",
  "SHARE_CREATE",
  "TELEGRAM_ERROR",
  "SETTINGS_UPDATE",
] as const;
