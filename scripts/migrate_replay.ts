import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { loadLocalEnv, requireEnv } from './_env';

async function applyAll(sql: postgres.Sql, migrationDir: string) {
  const files = (await fs.readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  for (const file of files) {
    const ddl = await fs.readFile(path.resolve(migrationDir, file), 'utf8');
    await sql.unsafe(ddl);
  }
}

async function main() {
  loadLocalEnv();
  const databaseUrl = requireEnv('DATABASE_URL');
  const sql = postgres(databaseUrl, { ssl: 'require' });
  const migrationDir = path.resolve('db/migrations');

  console.log('Applying migrations pass 1...');
  await applyAll(sql, migrationDir);
  console.log('Applying migrations pass 2 (idempotency check)...');
  await applyAll(sql, migrationDir);

  const [projects] = await sql`SELECT COUNT(*)::int AS count FROM projects`;
  const [takeoffs] = await sql`SELECT COUNT(*)::int AS count FROM takeoffs`;
  console.log(`Replay OK. projects=${projects.count} takeoffs=${takeoffs.count}`);
  await sql.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

