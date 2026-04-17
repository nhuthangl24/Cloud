import { randomBytes, randomUUID } from "node:crypto";
import { buildPublicLink, noop } from "@/server/services/misc";
import { mutateStore, readStore } from "@/lib/store";
import { FileChunk, FolderRecord, ShareRecord, StoredFile } from "@/lib/types";
import { getCategory, getExtension } from "@/server/services/file-classifier.service";
import { sha256FromBuffer } from "@/server/services/hash.service";
import { createLog } from "@/server/services/log.service";
import { ensureWithinQuota } from "@/server/services/quota.service";
import {
  deleteTelegramMessage,
  getTelegramFileDownloadUrl,
  groupTelegramDocuments,
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

export async function listFiles(options: ListFileOptions = {}) {
  const store = await readStore();
  let files = store.files.filter((file) => (options.includeDeleted ? true : !file.isDeleted));

  if (options.query) {
    const query = options.query.toLowerCase();
    files = files.filter(
      (file) =>
        file.displayName.toLowerCase().includes(query) ||
        file.originalName.toLowerCase().includes(query) ||
        file.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }

  if (options.category && options.category !== "all") {
    files = files.filter((file) => file.category === options.category);
  }

  if (options.folderId) {
    const folderIds = new Set<string>([options.folderId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const folder of store.folders) {
        if (folder.parentId && folderIds.has(folder.parentId) && !folderIds.has(folder.id)) {
          folderIds.add(folder.id);
          changed = true;
        }
      }
    }

    files = files.filter((file) => file.folderId !== null && folderIds.has(file.folderId));
  }

  const sorters: Record<string, (a: StoredFile, b: StoredFile) => number> = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    name: (a, b) => a.displayName.localeCompare(b.displayName),
    size: (a, b) => b.size - a.size,
  };

  return files.sort(sorters[options.sort ?? "newest"] ?? sorters.newest);
}

export async function getFileById(id: string) {
  const store = await readStore();
  const file = store.files.find((item) => item.id === id);
  if (!file) throw new Error("NOT_FOUND");
  return file;
}

export const getFileByIdForUser = getFileById;

export async function getFolders() {
  const store = await readStore();
  return store.folders;
}

export async function createFolder(name: string, parentId?: string | null) {
  const folder = await mutateStore((store) => {
    const parent = parentId ? store.folders.find((folder) => folder.id === parentId) : null;
    if (parentId && !parent) throw new Error("Parent folder not found");

    const nextFolder: FolderRecord = {
      id: randomUUID(),
      name,
      slug: slugify(name),
      parentId: parent?.id ?? null,
      path: parent ? `${parent.path}/${slugify(name)}` : slugify(name),
      createdAt: new Date().toISOString(),
    };

    store.folders.push(nextFolder);
    return nextFolder;
  });

  await createLog({
    action: "FOLDER_CREATE",
    status: "SUCCESS",
    message: `Created folder ${name}`,
  });

  return folder;
}

export async function deleteFolder(folderId: string) {
  let deletedFolderName = folderId;

  await mutateStore((store) => {
    const folder = store.folders.find((item) => item.id === folderId);
    if (!folder) throw new Error("NOT_FOUND");

    const hasFiles = store.files.some((file) => !file.isDeleted && file.folderId === folderId);
    if (hasFiles) throw new Error("Folder still contains files");

    const hasChildren = store.folders.some((item) => item.parentId === folderId);
    if (hasChildren) throw new Error("Folder still contains subfolders");

    store.folders = store.folders.filter((item) => item.id !== folderId);
    deletedFolderName = folder.name;
  });

  await createLog({
    action: "FOLDER_DELETE",
    status: "SUCCESS",
    message: `Deleted folder ${deletedFolderName}`,
  });

  return { deleted: true, folderId };
}

export async function uploadOwnedFile(params: {
  file: File;
  displayName?: string;
  description?: string;
  folderId?: string | null;
  tags?: string[];
}) {
  const settings = (await readStore()).settings;
  const existingStore = await readStore();
  ensureWithinQuota(existingStore.files, params.file.size, settings.storageQuotaBytes);

  const buffer = Buffer.from(await params.file.arrayBuffer());
  const sha256 = await sha256FromBuffer(buffer);
  const duplicate = existingStore.files.find(
    (item) => item.sha256 === sha256 && !item.isDeleted,
  );

  if (duplicate) {
    if (params.folderId && duplicate.folderId !== params.folderId) {
      const updatedDuplicate = await updateFile(duplicate.id, {
        folderId: params.folderId,
      });

      await createLog({
        action: "UPLOAD",
        status: "SUCCESS",
        message: `Reused existing file ${params.file.name} in a new folder`,
        fileId: updatedDuplicate.id,
        metadata: {
          deduplicated: true,
          folderId: params.folderId,
        },
      });

      return { file: updatedDuplicate, deduplicated: true };
    }

    return { file: duplicate, deduplicated: true };
  }

  const telegram = await uploadFileToTelegram(
    new File([buffer], params.file.name, { type: params.file.type }),
  );

  try {
    const created = await mutateStore((store) => {
      const now = new Date().toISOString();
      const nextFile: StoredFile = {
        id: randomUUID(),
        originalName: params.file.name,
        displayName: params.displayName || params.file.name,
        description: params.description || "",
        mimeType: params.file.type || "application/octet-stream",
        extension: getExtension(params.file.name),
        size: params.file.size,
        category: getCategory(params.file.type || "", params.file.name),
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

      store.files.unshift(nextFile);
      return nextFile;
    });

    await createLog({
      action: "UPLOAD",
      status: "SUCCESS",
      message: `Uploaded ${params.file.name}`,
      fileId: created.id,
      metadata: {
        telegramMessageId: telegram.telegramMessageId,
        telegramChatId: telegram.telegramChatId,
      },
    });

    return { file: created, deduplicated: false };
  } catch (error) {
    await createLog({
      action: "TELEGRAM_ERROR",
      status: "ERROR",
      message: "Metadata write failed after Telegram upload",
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
}) {
  const existingStore = await readStore();
  ensureWithinQuota(existingStore.files, params.size, existingStore.settings.storageQuotaBytes);

  const sortedChunks = [...params.chunks].sort((a, b) => a.index - b.index);

  let finalChunks = sortedChunks;
  try {
    const chatId = sortedChunks[0].telegramChatId;
    const fileIds = sortedChunks.map((c) => c.telegramFileId);
    const sizeFormatted = (params.size / 1024 / 1024).toFixed(1);
    const caption = `📦 ${params.originalName} (${params.chunks.length} chunks · ${sizeFormatted} MB)`;

    const grouped = await groupTelegramDocuments(chatId, fileIds, caption);
    
    // Asynchronously scrub temporary single-message uploads
    const oldMessageIds = sortedChunks.map((c) => c.telegramMessageId);
    Promise.all(oldMessageIds.map((mid) => deleteTelegramMessage(mid, chatId).catch(noop)));

    // Map to new message ids / file ids representing the media group album
    finalChunks = sortedChunks.map((chunk, i) => ({
      ...chunk,
      telegramMessageId: grouped[i]?.message_id ?? chunk.telegramMessageId,
      telegramFileId: grouped[i]?.file_id ?? chunk.telegramFileId,
    }));
  } catch (err) {
    // Fall back to original separate chunk messages if grouping fails
    console.error("Failed to group chunk telegram messages:", err);
  }

  const created = await mutateStore((store) => {
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
      telegramFileId: finalChunks[0].telegramFileId,
      telegramUniqueFileId: undefined,
      telegramMessageId: finalChunks[0].telegramMessageId,
      telegramChatId: finalChunks[0].telegramChatId,
      folderId: params.folderId ?? null,
      tags: params.tags ?? [],
      isChunked: true,
      chunks: finalChunks,
      isDeleted: false,
      deletedAt: null,
      downloadCount: 0,
      lastDownloadedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    store.files.unshift(nextFile);
    return nextFile;
  });

  await createLog({
    action: "UPLOAD",
    status: "SUCCESS",
    message: `Uploaded ${params.originalName} (${sortedChunks.length} chunks)`,
    fileId: created.id,
    metadata: { chunked: true, totalChunks: sortedChunks.length },
  });

  return { file: created, deduplicated: false };
}

export async function updateFile(id: string, partial: Partial<StoredFile>) {
  return mutateStore((store) => {
    const file = store.files.find((item) => item.id === id);
    if (!file) throw new Error("NOT_FOUND");
    Object.assign(file, partial, { updatedAt: new Date().toISOString() });
    return file;
  });
}

export async function incrementDownload(file: StoredFile) {
  return updateFile(file.id, {
    downloadCount: file.downloadCount + 1,
    lastDownloadedAt: new Date().toISOString(),
  });
}

export async function resolveDownloadUrl(file: StoredFile) {
  return getTelegramFileDownloadUrl(file.telegramFileId);
}

export async function softDeleteFile(file: StoredFile) {
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

export async function hardDeleteFile(file: StoredFile) {
  if (file.isChunked && file.chunks?.length) {
    await Promise.all(
      file.chunks.map((chunk) =>
        deleteTelegramMessage(chunk.telegramMessageId, chunk.telegramChatId).catch(noop),
      ),
    );
  } else {
    await deleteTelegramMessage(file.telegramMessageId, file.telegramChatId).catch(noop);
  }
  await mutateStore((store) => {
    store.files = store.files.filter((item) => item.id !== file.id);
    store.shares = store.shares.filter((item) => item.fileId !== file.id);
  });
  await createLog({
    action: "DELETE_HARD",
    status: "SUCCESS",
    message: `Hard deleted ${file.displayName}`,
    fileId: file.id,
  });
}

export async function listShares() {
  const store = await readStore();
  return store.shares;
}

export async function revokeShareLink(shareId: string) {
  let revoked = false;
  await mutateStore((store) => {
    const before = store.shares.length;
    store.shares = store.shares.filter((share) => share.id !== shareId);
    revoked = store.shares.length !== before;
  });

  if (!revoked) {
    throw new Error("NOT_FOUND");
  }

  await createLog({
    action: "SHARE_REVOKE",
    status: "SUCCESS",
    message: `Revoked share link ${shareId}`,
  });

  return { revoked: true };
}

export async function createShareLink(
  fileId: string,
  input: {
    expiresAt?: string | null;
    maxDownloads?: number | null;
    password?: string | null;
  },
) {
  const file = await getFileById(fileId);
  const settings = await readStore();
  if (settings.settings.privateLinksOnly && !input.expiresAt) {
    input.expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
  }

  const share = await mutateStore((store) => {
    const next: ShareRecord = {
      id: randomUUID(),
      fileId,
      token: randomBytes(18).toString("hex"),
      expiresAt: input.expiresAt ?? null,
      maxDownloads: input.maxDownloads ?? null,
      downloadCount: 0,
      password: input.password ?? null,
      createdAt: new Date().toISOString(),
    };
    store.shares.unshift(next);
    return next;
  });

  await createLog({
    action: "SHARE_CREATE",
    status: "SUCCESS",
    message: `Created share link for ${file.displayName}`,
    fileId,
  });

  return {
    share,
    publicUrl: buildPublicLink(share.token),
  };
}

export async function getShareByToken(token: string) {
  const store = await readStore();
  return store.shares.find((share) => share.token === token) ?? null;
}

export async function getFileByShareToken(token: string) {
  const share = await getShareByToken(token);
  if (!share) return null;
  const file = await getFileById(share.fileId);
  return { share, file };
}

export async function incrementShareDownload(shareId: string) {
  return mutateStore((store) => {
    const share = store.shares.find((item) => item.id === shareId);
    if (!share) throw new Error("NOT_FOUND");
    share.downloadCount += 1;
    return share;
  });
}

export { buildPublicLink };

export async function createFileDownloadResponse(file: StoredFile) {
  // Non-chunked: redirect to Telegram URL directly
  if (!file.isChunked || !file.chunks?.length) {
    const url = await resolveDownloadUrl(file);
    return Response.redirect(url, 302);
  }

  // Chunked: fetch all chunks from Telegram and stream them joined
  const sortedChunks = [...file.chunks].sort((a, b) => a.index - b.index);

  let chunkIndex = 0;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        if (!currentReader) {
          if (chunkIndex >= sortedChunks.length) {
            controller.close();
            return;
          }
          // Fetch URL lazily when we actually need the chunk
          const url = await getTelegramFileDownloadUrl(sortedChunks[chunkIndex].telegramFileId);
          const response = await fetch(url);
          if (!response.ok || !response.body) {
            throw new Error(`Failed to fetch chunk ${chunkIndex} from Telegram`);
          }
          currentReader = response.body.getReader();
        }

        const { done, value } = await currentReader.read();
        if (done) {
          currentReader = null;
          chunkIndex++;
          // immediately trigger next pull recursively
          return this.pull!(controller);
        }

        controller.enqueue(value);
      } catch (err) {
        controller.error(err);
      }
    },
  });

  const encodedName = encodeURIComponent(file.originalName);

  return new Response(stream, {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${file.originalName}"; filename*=UTF-8''${encodedName}`,
      "Content-Length": file.size.toString(),
    },
  });
}
