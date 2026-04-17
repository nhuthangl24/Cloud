import mongoose, { Schema } from "mongoose";
import type { FolderRecord } from "@/lib/types";

const FolderSchema = new Schema<FolderRecord>(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    slug: { type: String, required: true },
    parentId: { type: String, default: null },
    path: { type: String, required: true },
    createdAt: { type: String, required: true },
  },
  {},
);

export const FolderModel =
  mongoose.models.Folder ??
  mongoose.model<FolderRecord>("Folder", FolderSchema);
