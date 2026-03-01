import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server';
import { randomUUID } from 'node:crypto';

const isPublicRoute = createRouteMatcher(['/login', '/', '/review(.*)']);

export const onRequest = clerkMiddleware(async (auth, context, next) => {
  const requestId = context.request.headers.get('x-request-id') || randomUUID();
  (context.locals as any).requestId = requestId;

  if (!isPublicRoute(context.request) && !auth().userId) {
    const response = auth().redirectToSignIn();
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const response = await next();
  response.headers.set('x-request-id', requestId);
  return response;
});
