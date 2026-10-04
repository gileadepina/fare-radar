import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
for (const file of ['config.json','latest.json','history.json']) {
  const value = JSON.parse(await fs.readFile(path.join(root, 'data', file), 'utf8'));
  if (!value || typeof value !== 'object') throw new Error(`${file} inválido`);
}
console.log('Dados válidos.');
