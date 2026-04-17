import mongoose from "mongoose";
import { env } from "@/lib/env";

const MONGODB_URI = env.MONGODB_URI;

// Reuse connection across hot reloads in dev (Next.js serverless pattern)
declare global {
  var _mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

const cache = globalThis._mongooseCache ?? { conn: null, promise: null };
globalThis._mongooseCache = cache;

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
      })
      .then((m) => {
        cache.conn = m;
        return m;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
