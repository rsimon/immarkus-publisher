import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Config } from '../config.js';
import { rootCollectionUrl } from '../urls.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function buildViewerPage(config: Config): Promise<void> {
  const template = await readFile(join(__dirname, '../assets/viewer_template.html'), 'utf-8');

  const html = template
    .replaceAll('__TITLE__', escapeHtml(config.title))
    .replaceAll('__COLLECTION_URL__', rootCollectionUrl(config));

  await mkdir(config.outputDir, { recursive: true });
  await writeFile(join(config.outputDir, 'index.html'), html, 'utf-8');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}