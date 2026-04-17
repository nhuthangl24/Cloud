import { StoredFile } from "@/lib/types";

export function calculateUsedBytes(files: StoredFile[]) {
  return files.filter((file) => !file.isDeleted).reduce((sum, file) => sum + file.size, 0);
}

export function ensureWithinQuota(
  files: StoredFile[],
  incomingBytes: number,
  quotaBytes: number,
) {
  const usedBytes = calculateUsedBytes(files);
  if (usedBytes + incomingBytes > quotaBytes) {
    throw new Error("Storage quota exceeded");
  }
}
