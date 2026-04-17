import mongoose, { Schema } from "mongoose";
import type { ActivityRecord } from "@/lib/types";

const ActivitySchema = new Schema<ActivityRecord>(
  {
    id: { type: String, required: true, unique: true, index: true },
    action: { type: String, required: true },
    status: { type: String, required: true },
    message: { type: String, required: true },
    fileId: { type: String, default: null },
    createdAt: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {},
);

export const ActivityModel =
  mongoose.models.Activity ??
  mongoose.model<ActivityRecord>("Activity", ActivitySchema);
