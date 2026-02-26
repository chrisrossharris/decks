import postgres from 'postgres';

let _sql: postgres.Sql | null = null;

export function db() {
  if (!_sql) {
    _sql = postgres(import.meta.env.DATABASE_URL, {
      ssl: 'require',
      max: 1
    });
  }
  return _sql;
}
