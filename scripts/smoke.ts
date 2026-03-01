import { loadLocalEnv } from './_env';

loadLocalEnv();

const baseUrl = process.env.SMOKE_BASE_URL || 'http://localhost:4321';

async function check(path: string, options?: RequestInit & { expected?: number[] }) {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, options);
  const expected = options?.expected ?? [200];
  if (!expected.includes(response.status)) {
    throw new Error(`Smoke check failed: ${path} status=${response.status} expected=${expected.join(',')}`);
  }
  console.log(`OK ${path} -> ${response.status}`);
}

async function main() {
  console.log(`Running smoke checks against ${baseUrl}`);
  await check('/api/system/health');
  await check('/', { expected: [200] });
  await check('/login', { expected: [200, 302, 307, 308] });
  await check('/projects', { expected: [200, 302, 307, 308] });
  console.log('Smoke checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

