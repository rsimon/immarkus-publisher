import { IIIFBuilder } from '@iiif/builder';
import { writeJSON } from '../writer.js';
import {
  rootCollectionUrl,
  rootCollectionOutputPath,
  collectionUrl,
  collectionOutputPath,
} from '../urls.js';
import { buildLocalManifest } from './local-manifest.js';
import { buildIIIFManifest } from './iiif-manifest.js';
import type { Config } from '../config.js';
import type { DataModel } from '../datamodel.js';
import type { FolderNode } from '../types.js';

/**
 * Recursively process a FolderNode tree, building IIIF Collections and
 * Manifests bottom-up (children before parents, so parent collections
 * can reference already-written child resource URLs).
 *
 * @param node       The folder node to process
 * @param config     Publisher config
 * @param model      IMMARKUS data model (for annotation body crosswalk)
 * @param isRoot     True only for the top-level source directory
 * @returns          The URL of the Collection resource written for this folder
 */
export async function buildCollection(
  node: FolderNode,
  config: Config,
  model: DataModel,
  isRoot = false
): Promise<string> {
  const collUrl = isRoot
    ? rootCollectionUrl(config)
    : collectionUrl(config, node.path);

  const collOutputPath = isRoot
    ? rootCollectionOutputPath(config)
    : collectionOutputPath(config, node.path);

  // Process all children first, collecting their IIIF URLs
  const itemUrls: Array<{ url: string; type: 'Collection' | 'Manifest'; label: string }> = [];

  for (const child of node.children) {
    if (child.type === 'folder') {
      // Recurse — this writes the sub-collection and returns its URL
      const url = await buildCollection(child, config, model, false);
      itemUrls.push({ url, type: 'Collection', label: child.name });
      console.log(`  ✓ Collection: ${child.name}/`);

    } else if (child.type === 'localImage') {
      const url = await buildLocalManifest(child, config, model);
      itemUrls.push({ url, type: 'Manifest', label: child.name });
      console.log(`  ✓ Manifest (local): ${child.name}.${child.ext}`);

    } else if (child.type === 'iiifImport') {
      const url = await buildIIIFManifest(child, config, model);
      itemUrls.push({ url, type: 'Manifest', label: child.name });
      console.log(`  ✓ Manifest (IIIF import): ${child.name}`);
    }
  }

  // Build the Collection itself
  const builder = new IIIFBuilder();

  const label = isRoot ? config.title : node.meta?.label as string ?? node.name;

  const collection = builder.createCollection(collUrl, (coll) => {
    coll.addLabel(label, config.language);

    // Add metadata from _immarkus.folder.meta.json if present
    if (node.meta) {
      for (const [key, value] of Object.entries(node.meta)) {
        if (typeof value === 'string' && key !== 'label') {
          coll.addMetadata(
            { en: [key] },
            { [config.language]: [value] }
          );
        }
      }
    }

    // Add items — @iiif/builder expects minimal reference objects
    for (const item of itemUrls) {
      if (item.type === 'Collection') {
        coll.createCollection(item.url, (subColl) => {
          subColl.addLabel(item.label, config.language);
        });
      } else {
        coll.createManifest(item.url, (manifest) => {
          manifest.addLabel(item.label, config.language);
        });
      }
    }
  });

  const json = builder.toPresentation3({ id: collUrl, type: 'Collection' });

  await writeJSON(collOutputPath, json);

  return collUrl;
}
