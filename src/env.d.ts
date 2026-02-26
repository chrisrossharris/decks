/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly DATABASE_URL: string;
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
  readonly CLERK_SECRET_KEY: string;
  readonly NETLIFY_BLOBS_TOKEN?: string;
  readonly NETLIFY_BLOBS_SITE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
