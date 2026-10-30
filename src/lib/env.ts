import { z } from "zod";

const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().default("telegram-token-placeholder")),
  TELEGRAM_BOT_TOKENS: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_STORAGE_CHAT_ID: z.preprocess(emptyToUndefined, z.string().default("-1000000000000")),
  MONGODB_URI: z.preprocess(emptyToUndefined, z.string().default("mongodb://127.0.0.1:27017/cloud")),
  AUTH_USERNAME: z.preprocess(emptyToUndefined, z.string().default("admin")),
  AUTH_PASSWORD: z.preprocess(emptyToUndefined, z.string().default("ChangeMe123!")),
  AUTH_PASSWORD_HASH: z.preprocess(emptyToUndefined, z.string().optional()),
  AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().default("change-this-auth-secret-in-env-for-production-min32chars")),
  SESSION_TTL_HOURS: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(24)),
  MAX_FILE_SIZE: z.preprocess(emptyToUndefined, z.string().default("52428800")),
  ALLOWED_MIME_TYPES: z.preprocess(emptyToUndefined, z.string().default("*/*")),
  DEFAULT_STORAGE_QUOTA: z.preprocess(emptyToUndefined, z.string().default("5497558138880")),
  PUBLIC_APP_URL: z.preprocess(emptyToUndefined, z.string().default("http://localhost:3000")),
  PRIVATE_LINKS_ONLY: z.preprocess(emptyToUndefined, z.string().default("true")),
});

export const env = envSchema.parse({
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
  TELEGRAM_BOT_TOKENS: process.env.TELEGRAM_BOT_TOKENS,
  TELEGRAM_STORAGE_CHAT_ID: process.env.TELEGRAM_STORAGE_CHAT_ID,
  MONGODB_URI: process.env.MONGODB_URI,
  AUTH_USERNAME: process.env.AUTH_USERNAME,
  AUTH_PASSWORD: process.env.AUTH_PASSWORD,
  AUTH_PASSWORD_HASH: process.env.AUTH_PASSWORD_HASH,
  AUTH_SECRET: process.env.AUTH_SECRET,
  SESSION_TTL_HOURS: process.env.SESSION_TTL_HOURS,
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES: process.env.ALLOWED_MIME_TYPES,
  DEFAULT_STORAGE_QUOTA: process.env.DEFAULT_STORAGE_QUOTA,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
  PRIVATE_LINKS_ONLY: process.env.PRIVATE_LINKS_ONLY,
});
