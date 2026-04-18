import { z } from "zod";

export const fileUpdateSchema = z.object({
  displayName: z.string().min(1).max(160).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().min(1).max(32)).max(10).optional(),
  folderId: z.string().nullable().optional(),
});

export const createFolderSchema = z.object({
  name: z.string().min(1).max(80),
  parentId: z.string().nullable().optional(),
});

export const createShareLinkSchema = z.object({
  expiresAt: z.string().datetime().optional(),
  maxDownloads: z.number().int().positive().optional(),
  password: z.string().min(1).max(64).optional(),
});

export const settingsSchema = z.object({
  maxFileSize: z.number().int().positive().optional(),
  allowedMimeTypes: z.array(z.string()).optional(),
  storageQuotaBytes: z.number().int().positive().optional(),
  privateLinksOnly: z.boolean().optional(),
  telegramTokens: z.array(z.string()).optional(),
  telegramChatId: z.string().optional(),
  chunkSize: z.number().int().positive().max(19 * 1024 * 1024).optional(),
});
