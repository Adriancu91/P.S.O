import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildApp } from './app.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');

const app = await buildApp({
  dbPath: process.env.PSO_DB ?? join(root, 'data', 'pso.db'),
  logger: true,
  staticDir: join(root, 'client', 'dist'),
});

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: process.env.HOST ?? '0.0.0.0' });
