import { readdir, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import type { FolderNode, LocalImageNode, IIIFImportNode, SourceNode } from './types.js';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff']);

// IMMARKUS prefixes all its own files with _immarkus or _iiif
const IMMARKUS_PREFIX = '_immarkus';
const IIIF_PREFIX = '_iiif';

/**
 * Recursively scan an IMMARKUS work folder and return a FolderNode tree.
 */
export async function scanFolder(dirPath: string): Promise<FolderNode> {
  const name = basename(dirPath);
  const entries = await readdir(dirPath, { withFileTypes: true });

  // Read folder metadata if present
  const metaPath = join(dirPath, '_immarkus.folder.meta.json');
  let meta: Record<string, unknown> | null = null;
  try {
    const raw = await readFile(metaPath, 'utf-8');
    meta = JSON.parse(raw);
  } catch {
    // No metadata file — that's fine
  }

  // Collect all _iiif.<id>.json files in this directory so we can
  // pair them with their annotation sidecars.
  const iiifManifestFiles = new Map<string, string>(); // id → absolute path
  const iiifAnnotationFiles = new Map<string, string>(); // id → absolute path

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const fname = entry.name;

    if (fname.startsWith(IIIF_PREFIX) && fname.endsWith('.annotations.json')) {
      // _iiif.<id>.annotations.json
      const id = fname
        .slice(IIIF_PREFIX.length + 1) // strip "_iiif."
        .slice(0, -'.annotations.json'.length);
      iiifAnnotationFiles.set(id, join(dirPath, fname));
    } else if (fname.startsWith(IIIF_PREFIX) && fname.endsWith('.json')) {
      // _iiif.<id>.json  (but NOT the annotations sidecar)
      const id = fname
        .slice(IIIF_PREFIX.length + 1) // strip "_iiif."
        .slice(0, -'.json'.length);
      iiifManifestFiles.set(id, join(dirPath, fname));
    }
  }

  // Now build children
  const children: SourceNode[] = [];

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subfolders (skip hidden dirs like .git)
      if (!entry.name.startsWith('.')) {
        children.push(await scanFolder(fullPath));
      }
      continue;
    }

    if (!entry.isFile()) continue;

    const fname = entry.name;

    // Skip all IMMARKUS metadata files
    if (fname.startsWith(IMMARKUS_PREFIX) || fname.startsWith(IIIF_PREFIX)) {
      continue;
    }

    const ext = extname(fname).toLowerCase();

    if (IMAGE_EXTENSIONS.has(ext)) {
      const node: LocalImageNode = {
        type: 'localImage',
        path: fullPath,
        name: basename(fname, ext),
        ext: ext.slice(1), // strip the dot
      };
      children.push(node);
    }
    // Non-image, non-IMMARKUS files are silently ignored for now
  }

  // Add IIIF import nodes — one per _iiif.<id>.json file
  for (const [id, manifestCachePath] of iiifManifestFiles) {
    const node: IIIFImportNode = {
      type: 'iiifImport',
      manifestCachePath,
      annotationsPath: iiifAnnotationFiles.get(id) ?? null,
      id,
    };
    children.push(node);
  }

  // Sort children: folders first, then by name for stability
  children.sort((a, b) => {
    const aIsFolder = a.type === 'folder' ? 0 : 1;
    const bIsFolder = b.type === 'folder' ? 0 : 1;
    if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder;
    const aName = 'name' in a ? a.name : a.id;
    const bName = 'name' in b ? b.name : b.id;
    return aName.localeCompare(bName);
  });

  return { type: 'folder', path: dirPath, name, meta, children };
}

/** Pretty-print the tree for debugging */
export function printTree(node: SourceNode, indent = 0): void {
  const pad = '  '.repeat(indent);

  if (node.type === 'folder') {
    console.log(`${pad}📁 ${node.name}/`);
    for (const child of node.children) {
      printTree(child, indent + 1);
    }
  } else if (node.type === 'localImage') {
    console.log(`${pad}🖼  ${node.name}.${node.ext}`);
  } else if (node.type === 'iiifImport') {
    const hasAnnotations = node.annotationsPath ? ' ✎' : '';
    console.log(`${pad}🌐 [iiif:${node.id}]${hasAnnotations}`);
  }
}

/** Count all leaf nodes for progress reporting */
export function countLeaves(node: FolderNode): number {
  let count = 0;
  for (const child of node.children) {
    if (child.type === 'folder') {
      count += countLeaves(child);
    } else {
      count += 1;
    }
  }
  return count;
}
