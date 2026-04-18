import { z } from "zod";

const envSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1).default("telegram-token-placeholder"),
  TELEGRAM_BOT_TOKENS: z.string().optional(),
  TELEGRAM_STORAGE_CHAT_ID: z.string().min(1).default("-1000000000000"),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  AUTH_USERNAME: z.string().min(1).default("admin"),
  AUTH_PASSWORD: z.string().min(8).default("ChangeMe123!"),
  AUTH_PASSWORD_HASH: z.string().optional(),
  AUTH_SECRET: z.string().min(32).default("change-this-auth-secret-in-env-for-production"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  MAX_FILE_SIZE: z.string().default("52428800"),
  ALLOWED_MIME_TYPES: z.string().default("*/*"),
  DEFAULT_STORAGE_QUOTA: z.string().default("5497558138880"),
  PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),
  PRIVATE_LINKS_ONLY: z.string().default("true"),
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
