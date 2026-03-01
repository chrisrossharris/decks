import postgres from 'postgres';
import { getEnv } from '@/lib/config/env';

let _sql: postgres.Sql | null = null;

export function db() {
  if (!_sql) {
    const env = getEnv();
    _sql = postgres(env.DATABASE_URL, {
      ssl: 'require',
      max: 1
    });
  }
  return _sql;
}
