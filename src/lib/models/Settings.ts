import mongoose, { Schema } from "mongoose";
import type { AppSettings } from "@/lib/types";

// Settings is a singleton document — always upserted with a fixed docId
export const SETTINGS_DOC_ID = "singleton";

const SettingsSchema = new Schema<AppSettings & { docId: string }>(
  {
    docId: { type: String, required: true, unique: true, default: SETTINGS_DOC_ID },
    maxFileSize: { type: Number, required: true },
    allowedMimeTypes: { type: [String], required: true },
    storageQuotaBytes: { type: Number, required: true },
    privateLinksOnly: { type: Boolean, required: true },
    telegramTokens: { type: [String], required: true },
    telegramChatId: { type: String, required: true },
    chunkSize: { type: Number, required: true },
  },
  {},
);

export const SettingsModel =
  mongoose.models.Settings ??
  mongoose.model<AppSettings & { docId: string }>("Settings", SettingsSchema);
