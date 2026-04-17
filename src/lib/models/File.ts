import mongoose, { Schema } from "mongoose";
import type { StoredFile } from "@/lib/types";

const FileSchema = new Schema<StoredFile>(
  {
    id: { type: String, required: true, unique: true, index: true },
    originalName: { type: String, required: true },
    displayName: { type: String, required: true },
    description: { type: String, default: "" },
    mimeType: { type: String, required: true },
    extension: { type: String, required: true },
    size: { type: Number, required: true },
    category: { type: String, required: true },
    sha256: { type: String, required: true, index: true },
    telegramFileId: { type: String, required: true },
    telegramUniqueFileId: { type: String },
    telegramMessageId: { type: Number, required: true },
    telegramChatId: { type: String, required: true },
    folderId: { type: String, default: null },
    tags: { type: [String], default: [] },
    isChunked: { type: Boolean, default: false },
    // stored as plain objects, cast back to FileChunk[] when read
    chunks: { type: Schema.Types.Mixed, default: [] } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: String, default: null },
    downloadCount: { type: Number, default: 0 },
    lastDownloadedAt: { type: String, default: null },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  {},
);

export const FileModel =
  mongoose.models.File ?? mongoose.model<StoredFile>("File", FileSchema);
