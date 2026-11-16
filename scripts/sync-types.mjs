import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const sourceFile = path.join(rootDir, 'shared', 'types.ts');
const destClient = path.join(rootDir, 'client', 'src', 'types', 'shared.ts');
const destServer = path.join(rootDir, 'server', 'src', 'types', 'shared.ts');

fs.mkdirSync(path.dirname(destClient), { recursive: true });
fs.mkdirSync(path.dirname(destServer), { recursive: true });

fs.copyFileSync(sourceFile, destClient);
fs.copyFileSync(sourceFile, destServer);

console.log('[sync-types] Mirrored shared/types.ts -> client/src/types/shared.ts & server/src/types/shared.ts');
