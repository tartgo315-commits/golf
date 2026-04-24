import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, 'node_modules', '.playwright-browsers');
process.env.PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT ??= '120000';
execSync('npx playwright install chromium', { stdio: 'inherit', env: process.env, cwd: root });
