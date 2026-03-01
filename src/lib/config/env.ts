import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1)
});

let cached: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (cached) return cached;
  const parsed = envSchema.safeParse({
    DATABASE_URL: import.meta.env.DATABASE_URL,
    PUBLIC_CLERK_PUBLISHABLE_KEY: import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: import.meta.env.CLERK_SECRET_KEY
  });
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`);
  }
  cached = parsed.data;
  return cached;
}

