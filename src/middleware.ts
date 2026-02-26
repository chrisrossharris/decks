import { clerkMiddleware, createRouteMatcher } from '@clerk/astro/server';

const isPublicRoute = createRouteMatcher(['/login', '/', '/review(.*)']);

export const onRequest = clerkMiddleware((auth, context, next) => {
  if (!isPublicRoute(context.request) && !auth().userId) {
    return auth().redirectToSignIn();
  }
  return next();
});
