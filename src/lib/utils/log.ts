import type { APIContext } from 'astro';

type LogLevel = 'info' | 'warn' | 'error';

export function apiLog(context: APIContext, level: LogLevel, event: string, meta: Record<string, unknown> = {}) {
  const requestId = (context.locals as any)?.requestId ?? context.request.headers.get('x-request-id') ?? 'n/a';
  const method = context.request.method;
  const path = new URL(context.request.url).pathname;
  const userId = context.locals.auth?.().userId ?? null;

  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    request_id: requestId,
    method,
    path,
    user_id: userId,
    ...meta
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

