import mongoose, { Schema } from "mongoose";
import type { ShareRecord } from "@/lib/types";

const ShareSchema = new Schema<ShareRecord>(
  {
    id: { type: String, required: true, unique: true, index: true },
    fileId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: String, default: null },
    maxDownloads: { type: Number, default: null },
    downloadCount: { type: Number, default: 0 },
    password: { type: String, default: null },
    createdAt: { type: String, required: true },
  },
  {},
);

export const ShareModel =
  mongoose.models.Share ?? mongoose.model<ShareRecord>("Share", ShareSchema);
