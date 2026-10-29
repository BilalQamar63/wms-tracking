import mongoose from 'mongoose';
import { getEnv } from '@/lib/env';
import { connectWithDnsFallback } from './dns-fallback';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = (globalThis.__mongooseCache ??= { conn: null, promise: null });

/**
 * Returns a shared Mongoose connection. The connection is cached on `globalThis`
 * so hot-reloads in development and serverless invocations re-use it.
 */
export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    mongoose.set('strictQuery', true);
    const uri = getEnv().MONGODB_URI;
    cache.promise = connectWithDnsFallback(uri, () =>
      mongoose.connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 10_000,
      }),
    );
  }

  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
