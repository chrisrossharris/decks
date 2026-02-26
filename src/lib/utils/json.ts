export function parseJsonObject<T extends Record<string, unknown>>(
  value: unknown,
  fallback: T
): T {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as T;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}
