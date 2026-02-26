export function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function toBytes(value: unknown): Buffer {
  if (value instanceof Uint8Array) return Buffer.from(value);
  return Buffer.from([]);
}
