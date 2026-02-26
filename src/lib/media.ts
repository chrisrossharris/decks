import { getStore } from '@netlify/blobs';

const IMAGE_STORE = 'decktakeoff-images';

export async function storeProjectImage(path: string, bytes: Uint8Array, contentType: string) {
  const store = getStore(IMAGE_STORE);
  await store.set(path, Buffer.from(bytes), { contentType });
  return path;
}

export async function readProjectImage(path: string) {
  const store = getStore(IMAGE_STORE);
  const data = await store.get(path, { type: 'arrayBuffer' });
  return data ? Buffer.from(data) : null;
}
