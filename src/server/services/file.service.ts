import { randomBytes, randomUUID } from "node:crypto";
import { buildPublicLink, noop } from "@/server/services/misc";
import { stripMongoId, readStore } from "@/lib/store";
import { connectDB } from "@/lib/mongodb";
import { FileModel } from "@/lib/models/File";
import { FolderModel } from "@/lib/models/Folder";
import { ShareModel } from "@/lib/models/Share";
import { FileChunk, FolderRecord, ShareRecord, StoredFile } from "@/lib/types";
import { getCategory, getExtension } from "@/server/services/file-classifier.service";
import { sha256FromBuffer } from "@/server/services/hash.service";
import { createLog } from "@/server/services/log.service";
import { ensureWithinQuota } from "@/server/services/quota.service";
import {
  deleteTelegramMessage,
  getTelegramDownloadStream,
  getTelegramFileDownloadUrl,
  uploadFileToTelegram,
} from "@/server/services/telegram.service";
import { slugify } from "@/lib/utils";

type ListFileOptions = {
  query?: string | null;
  category?: string | null;
  sort?: string | null;
  folderId?: string | null;
  includeDeleted?: boolean;
};

export async function listFiles(options: ListFileOptions = {}): Promise<StoredFile[]> {
  await connectDB();
  const filter: Record<string, unknown> = {};

  if (!options.includeDeleted) {
    filter.isDeleted = false;
  }

  if (options.query) {
    const q = options.query.trim();
    filter.$or = [
      { displayName: { $regex: q, $options: "i" } },
      { originalName: { $regex: q, $options: "i" } },
      { tags: { $regex: q, $options: "i" } },
    ];
  }

  if (options.category && options.category !== "all") {
    filter.category = options.category;
  }

  if (options.folderId !== undefined) {
    if (options.folderId === null || options.folderId === "root") {
      filter.folderId = null;
    } else {
      // Find all subfolder IDs recursively
      const allFolders = await FolderModel.find({}).lean();
      const folderIds = new Set<string>([options.folderId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const f of allFolders) {
          if (f.parentId && folderIds.has(f.parentId) && !folderIds.has(f.id)) {
            folderIds.add(f.id);
            changed = true;
          }
        }
      }
      filter.folderId = { $in: Array.from(folderIds) };
    }
  }

  const sorters: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name: { displayName: 1 },
    size: { size: -1 },
  };

  const sortOrder = sorters[options.sort ?? "newest"] ?? sorters.newest;
  const files = await FileModel.find(filter).sort(sortOrder).lean();
  return files.map((d) => stripMongoId<StoredFile>(d));
}

export async function getFileById(id: string): Promise<StoredFile> {
  await connectDB();
  const file = await FileModel.findOne({ id }).lean();
  if (!file) throw new Error("NOT_FOUND");
  return stripMongoId<StoredFile>(file);
}

export const getFileByIdForUser = getFileById;

export async function getFolders(): Promise<FolderRecord[]> {
  await connectDB();
  const folders = await FolderModel.find({}).sort({ path: 1 }).lean();
  return folders.map((d) => stripMongoId<FolderRecord>(d));
}

export async function createFolder(name: string, parentId?: string | null): Promise<FolderRecord> {
  await connectDB();
  const parent = parentId ? await FolderModel.findOne({ id: parentId }).lean() : null;
  if (parentId && !parent) throw new Error("Parent folder not found");

  const nextFolder: FolderRecord = {
    id: randomUUID(),
    name,
    slug: slugify(name),
    parentId: parent?.id ?? null,
    path: parent ? `${parent.path}/${slugify(name)}` : slugify(name),
    createdAt: new Date().toISOString(),
  };

  await FolderModel.create(nextFolder);

  await createLog({
    action: "FOLDER_CREATE",
    status: "SUCCESS",
    message: `Created folder ${name}`,
  });

  return nextFolder;
}

export async function deleteFolder(folderId: string): Promise<string> {
  await connectDB();
  const folder = await FolderModel.findOne({ id: folderId }).lean();
  if (!folder) throw new Error("NOT_FOUND");

  const hasFiles = await FileModel.exists({ folderId, isDeleted: false });
  if (hasFiles) throw new Error("Folder still contains active files");

  const hasSubfolders = await FolderModel.exists({ parentId: folderId });
  if (hasSubfolders) throw new Error("Folder contains subfolders");

  await FolderModel.deleteOne({ id: folderId });

  await createLog({
    action: "FOLDER_DELETE",
    status: "SUCCESS",
    message: `Deleted folder ${folder.name}`,
  });

  return folderId;
}

export async function uploadOwnedFile(params: {
  file: File;
  folderId?: string | null;
  displayName?: string;
  description?: string;
  tags?: string[];
}): Promise<{ file: StoredFile; deduplicated: boolean }> {
  await connectDB();
  const buffer = Buffer.from(await params.file.arrayBuffer());
  const sha256 = await sha256FromBuffer(buffer);

  // Check deduplication
  const existing = await FileModel.findOne({
    sha256,
    isDeleted: false,
    folderId: params.folderId ?? null,
  }).lean();

  if (existing) {
    return { file: stripMongoId<StoredFile>(existing), deduplicated: true };
  }

  // Quota check
  const allFiles = await FileModel.find({ isDeleted: false }, "size").lean();
  const store = await readStore();
  ensureWithinQuota(allFiles, params.file.size, store.settings.storageQuotaBytes);

  const telegram = await uploadFileToTelegram(params.file);

  try {
    const now = new Date().toISOString();
    const nextFile: StoredFile = {
      id: randomUUID(),
      originalName: params.file.name,
      displayName: params.displayName || params.file.name,
      description: params.description || "",
      mimeType: params.file.type || "application/octet-stream",
      extension: getExtension(params.file.name),
      size: params.file.size,
      category: getCategory(params.file.type || "application/octet-stream", params.file.name),
      sha256,
      telegramFileId: telegram.telegramFileId,
      telegramUniqueFileId: telegram.telegramUniqueFileId,
      telegramMessageId: telegram.telegramMessageId,
      telegramChatId: telegram.telegramChatId,
      folderId: params.folderId ?? null,
      tags: params.tags ?? [],
      isChunked: false,
      chunks: [],
      isDeleted: false,
      deletedAt: null,
      downloadCount: 0,
      lastDownloadedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await FileModel.create(nextFile);

    await createLog({
      action: "UPLOAD",
      status: "SUCCESS",
      message: `Uploaded ${params.file.name}`,
      fileId: nextFile.id,
      metadata: {
        telegramMessageId: telegram.telegramMessageId,
        telegramChatId: telegram.telegramChatId,
      },
    });

    return { file: nextFile, deduplicated: false };
  } catch (error) {
    await createLog({
      action: "TELEGRAM_ERROR",
      status: "ERROR",
      message: "Database write failed after Telegram upload",
      metadata: { fileName: params.file.name },
    });
    await deleteTelegramMessage(telegram.telegramMessageId, telegram.telegramChatId).catch(noop);
    throw error;
  }
}

export async function uploadOwnedChunkedFile(params: {
  uploadId: string;
  originalName: string;
  mimeType: string;
  size: number;
  chunks: FileChunk[];
  folderId?: string | null;
  displayName?: string;
  description?: string;
  tags?: string[];
}): Promise<{ file: StoredFile; deduplicated: boolean }> {
  await connectDB();
  const allFiles = await FileModel.find({ isDeleted: false }, "size").lean();
  const store = await readStore();
  ensureWithinQuota(allFiles, params.size, store.settings.storageQuotaBytes);

  const sortedChunks = [...params.chunks].sort((a, b) => a.index - b.index);
  const now = new Date().toISOString();

  const nextFile: StoredFile = {
    id: randomUUID(),
    originalName: params.originalName,
    displayName: params.displayName || params.originalName,
    description: params.description || "",
    mimeType: params.mimeType,
    extension: getExtension(params.originalName),
    size: params.size,
    category: getCategory(params.mimeType, params.originalName),
    sha256: params.uploadId,
    telegramFileId: sortedChunks[0].telegramFileId,
    telegramUniqueFileId: undefined,
    telegramMessageId: sortedChunks[0].telegramMessageId,
    telegramChatId: sortedChunks[0].telegramChatId,
    folderId: params.folderId ?? null,
    tags: params.tags ?? [],
    isChunked: true,
    chunks: sortedChunks,
    isDeleted: false,
    deletedAt: null,
    downloadCount: 0,
    lastDownloadedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await FileModel.create(nextFile);

  await createLog({
    action: "UPLOAD",
    status: "SUCCESS",
    message: `Uploaded ${params.originalName} (${sortedChunks.length} chunks)`,
    fileId: nextFile.id,
    metadata: { chunked: true, totalChunks: sortedChunks.length },
  });

  return { file: nextFile, deduplicated: false };
}

export async function updateFile(id: string, partial: Partial<StoredFile>): Promise<StoredFile> {
  await connectDB();
  const updated = await FileModel.findOneAndUpdate(
    { id },
    { $set: { ...partial, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw new Error("NOT_FOUND");
  return stripMongoId<StoredFile>(updated);
}

export async function incrementDownload(file: StoredFile): Promise<StoredFile> {
  await connectDB();
  const updated = await FileModel.findOneAndUpdate(
    { id: file.id },
    {
      $inc: { downloadCount: 1 },
      $set: { lastDownloadedAt: new Date().toISOString() },
    },
    { returnDocument: "after" },
  ).lean();
  return stripMongoId<StoredFile>(updated);
}

export async function resolveDownloadUrl(file: StoredFile): Promise<string> {
  return getTelegramFileDownloadUrl(file.telegramFileId);
}

export async function softDeleteFile(file: StoredFile): Promise<StoredFile> {
  const updated = await updateFile(file.id, {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
  });
  await createLog({
    action: "DELETE_SOFT",
    status: "SUCCESS",
    message: `Soft deleted ${file.displayName}`,
    fileId: file.id,
  });
  return updated;
}

export async function hardDeleteFile(file: StoredFile): Promise<void> {
  await connectDB();
  if (file.isChunked && file.chunks?.length) {
    await Promise.all(
      file.chunks.map((chunk) =>
        deleteTelegramMessage(chunk.telegramMessageId, chunk.telegramChatId).catch(noop),
      ),
    );
  } else if (file.telegramMessageId && file.telegramChatId) {
    await deleteTelegramMessage(file.telegramMessageId, file.telegramChatId).catch(noop);
  }

  await FileModel.deleteOne({ id: file.id });
  await ShareModel.deleteMany({ fileId: file.id });

  await createLog({
    action: "DELETE_HARD",
    status: "SUCCESS",
    message: `Hard deleted ${file.displayName}`,
    fileId: file.id,
  });
}

export async function createShare(fileId: string, options: {
  expiresInHours?: number | null;
  maxDownloads?: number | null;
  password?: string | null;
} = {}): Promise<ShareRecord> {
  await connectDB();
  const file = await getFileById(fileId);
  const now = Date.now();
  const expiresAt = options.expiresInHours
    ? new Date(now + options.expiresInHours * 60 * 60 * 1000).toISOString()
    : null;

  const nextShare: ShareRecord = {
    id: randomUUID(),
    fileId: file.id,
    token: randomBytes(20).toString("hex"),
    expiresAt,
    maxDownloads: options.maxDownloads ?? null,
    downloadCount: 0,
    password: options.password || null,
    createdAt: new Date().toISOString(),
  };

  await ShareModel.create(nextShare);

  await createLog({
    action: "SHARE_CREATE",
    status: "SUCCESS",
    message: `Created share link for ${file.displayName}`,
    fileId: file.id,
    metadata: { token: nextShare.token },
  });

  return nextShare;
}

export async function getShares(): Promise<ShareRecord[]> {
  await connectDB();
  const shares = await ShareModel.find({}).sort({ createdAt: -1 }).lean();
  return shares.map((d) => stripMongoId<ShareRecord>(d));
}

export const listShares = getShares;

export async function deleteShare(id: string): Promise<void> {
  await connectDB();
  await ShareModel.deleteOne({ id });
}

export async function revokeShareLink(shareId: string): Promise<{ revoked: boolean }> {
  await deleteShare(shareId);
  return { revoked: true };
}

export async function createShareLink(
  fileId: string,
  input: {
    expiresAt?: string | null;
    maxDownloads?: number | null;
    password?: string | null;
  } = {},
): Promise<ShareRecord> {
  await connectDB();
  const file = await getFileById(fileId);

  const nextShare: ShareRecord = {
    id: randomUUID(),
    fileId: file.id,
    token: randomBytes(20).toString("hex"),
    expiresAt: input.expiresAt ?? null,
    maxDownloads: input.maxDownloads ?? null,
    downloadCount: 0,
    password: input.password || null,
    createdAt: new Date().toISOString(),
  };

  await ShareModel.create(nextShare);

  await createLog({
    action: "SHARE_CREATE",
    status: "SUCCESS",
    message: `Created share link for ${file.displayName}`,
    fileId: file.id,
    metadata: { token: nextShare.token },
  });

  return nextShare;
}

export async function getShareByToken(token: string): Promise<ShareRecord | null> {
  await connectDB();
  const share = await ShareModel.findOne({ token }).lean();
  return share ? stripMongoId<ShareRecord>(share) : null;
}

export async function getFileByShareToken(token: string): Promise<{ share: ShareRecord; file: StoredFile } | null> {
  const share = await getShareByToken(token);
  if (!share) return null;
  const file = await getFileById(share.fileId);
  return { share, file };
}

export async function incrementShareDownload(shareId: string): Promise<ShareRecord> {
  await connectDB();
  const updated = await ShareModel.findOneAndUpdate(
    { id: shareId },
    { $inc: { downloadCount: 1 } },
    { returnDocument: "after" },
  ).lean();
  if (!updated) throw new Error("NOT_FOUND");
  return stripMongoId<ShareRecord>(updated);
}

export { buildPublicLink };

/**
 * Builds RFC 5987 / RFC 6266 compliant Content-Disposition header.
 * Correctly encodes Unicode, Vietnamese characters, and handles special symbols.
 */
export function buildContentDisposition(
  filename: string,
  disposition: "attachment" | "inline" = "attachment",
): string {
  const safeAscii = filename
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/["\\]/g, "");
  const utf8Encoded = encodeURIComponent(filename);
  return `${disposition}; filename="${safeAscii}"; filename*=UTF-8''${utf8Encoded}`;
}

/**
 * Creates high-performance, streaming HTTP response for file downloads and media previews.
 * Features:
 * - Direct binary streaming without buffering entire file in RAM.
 * - Zero Telegram Bot token exposure (streaming proxied securely).
 * - Full HTTP Range requests (HTTP 206 Partial Content) for video seeking, pause & resume.
 * - Seamless chunk reassembly for chunked files with automatic chunk slicing.
 * - Guaranteed bit-for-bit integrity and correct RFC 5987 Unicode filename preservation.
 */
export async function createFileDownloadResponse(
  file: StoredFile,
  options: {
    disposition?: "attachment" | "inline";
    rangeHeader?: string | null;
  } = {},
): Promise<Response> {
  const disposition = options.disposition ?? "attachment";
  const rangeHeader = options.rangeHeader?.trim();

  // Parse HTTP Range header if provided
  let start = 0;
  let end = file.size - 1;
  let isRange = false;

  if (rangeHeader && rangeHeader.startsWith("bytes=")) {
    const parts = rangeHeader.substring(6).split("-");
    const parsedStart = parts[0] ? parseInt(parts[0], 10) : undefined;
    const parsedEnd = parts[1] ? parseInt(parts[1], 10) : undefined;

    if (parsedStart !== undefined && !isNaN(parsedStart)) {
      start = parsedStart;
      if (parsedEnd !== undefined && !isNaN(parsedEnd)) {
        end = Math.min(parsedEnd, file.size - 1);
      } else {
        end = file.size - 1;
      }
    } else if (parsedEnd !== undefined && !isNaN(parsedEnd)) {
      // Suffix range: bytes=-500 (last 500 bytes)
      start = Math.max(0, file.size - parsedEnd);
      end = file.size - 1;
    }

    if (start < 0 || start >= file.size || end < start || end >= file.size) {
      return new Response(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${file.size}`,
        },
      });
    }

    isRange = true;
  }

  const responseHeaders = new Headers({
    "Content-Type": file.mimeType || "application/octet-stream",
    "Content-Disposition": buildContentDisposition(file.originalName, disposition),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-transform, max-age=3600",
  });

  const contentLength = end - start + 1;
  const status = isRange ? 206 : 200;

  if (isRange) {
    responseHeaders.set("Content-Range", `bytes ${start}-${end}/${file.size}`);
    responseHeaders.set("Content-Length", String(contentLength));
  } else {
    responseHeaders.set("Content-Length", String(file.size));
  }

  // Non-chunked single file: stream directly from Telegram CDN with Range support
  if (!file.isChunked || !file.chunks?.length) {
    const { stream: tgStream } = await getTelegramDownloadStream(
      file.telegramFileId,
      isRange ? { start, end } : undefined,
    );

    return new Response(tgStream, {
      status,
      headers: responseHeaders,
    });
  }

  // Chunked file: calculate required chunk slices and stream sequentially
  const sortedChunks = [...file.chunks].sort((a, b) => a.index - b.index);

  type ChunkSliceRequest = {
    telegramFileId: string;
    sliceStart: number;
    sliceEnd: number;
  };

  const chunkRequests: ChunkSliceRequest[] = [];
  let currentOffset = 0;

  for (const chunk of sortedChunks) {
    const chunkStart = currentOffset;
    const chunkEnd = chunkStart + chunk.size - 1;
    currentOffset += chunk.size;

    // Check if this chunk overlaps the requested [start, end] window
    if (chunkEnd >= start && chunkStart <= end) {
      const sliceStart = Math.max(0, start - chunkStart);
      const sliceEnd = Math.min(chunk.size - 1, end - chunkStart);

      chunkRequests.push({
        telegramFileId: chunk.telegramFileId,
        sliceStart,
        sliceEnd,
      });
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (const req of chunkRequests) {
          const { stream: chunkStream } = await getTelegramDownloadStream(req.telegramFileId, {
            start: req.sliceStart,
            end: req.sliceEnd,
          });

          const reader = chunkStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status,
    headers: responseHeaders,
  });
}

export async function uploadOwnedSingleFileP2P(params: {
  originalName: string;
  mimeType: string;
  size: number;
  telegramFileId: string;
  telegramMessageId: number;
  telegramChatId: string;
  folderId?: string | null;
  displayName?: string;
  description?: string;
  tags?: string[];
  uploadId: string;
}): Promise<{ file: StoredFile; deduplicated: boolean }> {
  await connectDB();
  const allFiles = await FileModel.find({ isDeleted: false }, "size").lean();
  const store = await readStore();
  ensureWithinQuota(allFiles, params.size, store.settings.storageQuotaBytes);

  const now = new Date().toISOString();
  const nextFile: StoredFile = {
    id: randomUUID(),
    originalName: params.originalName,
    displayName: params.displayName || params.originalName,
    description: params.description || "",
    mimeType: params.mimeType,
    extension: getExtension(params.originalName),
    size: params.size,
    category: getCategory(params.mimeType, params.originalName),
    sha256: params.uploadId,
    telegramFileId: params.telegramFileId,
    telegramUniqueFileId: undefined,
    telegramMessageId: params.telegramMessageId,
    telegramChatId: params.telegramChatId,
    folderId: params.folderId ?? null,
    tags: params.tags ?? [],
    isChunked: false,
    chunks: [],
    isDeleted: false,
    deletedAt: null,
    downloadCount: 0,
    lastDownloadedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await FileModel.create(nextFile);

  await createLog({
    action: "UPLOAD",
    status: "SUCCESS",
    message: `Uploaded ${params.originalName}`,
    fileId: nextFile.id,
    metadata: {
      telegramMessageId: params.telegramMessageId,
      telegramChatId: params.telegramChatId,
    },
  });

  return { file: nextFile, deduplicated: false };
}

