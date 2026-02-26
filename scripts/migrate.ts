import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';
import { loadLocalEnv, requireEnv } from './_env';

async function main() {
  loadLocalEnv();
  const databaseUrl = requireEnv('DATABASE_URL');

  const sql = postgres(databaseUrl, { ssl: 'require' });
  const migrationDir = path.resolve('db/migrations');
  const files = (await fs.readdir(migrationDir))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const migrationPath = path.resolve(migrationDir, file);
    const ddl = await fs.readFile(migrationPath, 'utf8');
    await sql.unsafe(ddl);
    console.log('Migration applied:', migrationPath);
  }
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
