import type { APIContext } from 'astro';

export function requireUserId(context: APIContext): string {
  const userId = context.locals.auth?.().userId;
  if (!userId) {
    throw new Error('Unauthorized');
  }
  return userId;
}
