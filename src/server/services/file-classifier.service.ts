import path from "node:path";

export function getExtension(fileName: string) {
  return path.extname(fileName).replace(".", "").toLowerCase() || "bin";
}

export function getCategory(mimeType: string, fileName: string) {
  const extension = getExtension(fileName);

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("word") ||
    mimeType.includes("sheet") ||
    mimeType.includes("presentation") ||
    mimeType.includes("text")
  ) {
    return "document";
  }

  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) return "archive";
  return "other";
}
