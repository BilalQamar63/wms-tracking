import { z } from 'zod';

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SESSION_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  APP_TIMEZONE: z.string().default('UTC'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validated, memoised environment. Evaluated lazily so `next build` does not need secrets. */
export function getEnv(): Env {
  if (!cached) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new Error(`Invalid environment configuration – ${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
