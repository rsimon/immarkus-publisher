import type { Config } from '../config.js';
import type { IIIFImportNode } from '../types.js';
import { iiifManifestUrl } from '../urls.js';
import { dirname } from 'path';

/**
 * Build a derivative IIIF manifest from an imported IMMARKUS IIIF resource.
 *
 * This is a STUB — the full implementation requires understanding how
 * IMMARKUS constructs internal canvas IDs (the murmur hash scheme) so
 * we can rewrite annotation targets correctly.
 *
 * For now we read the cached manifest JSON and log what we find,
 * so we can inspect the data shape and design the rewriting logic.
 *
 * Returns the manifest URL (for use in parent collection's items list).
 */
export async function buildIIIFManifest(
  node: IIIFImportNode,
  config: Config
): Promise<string> {
  const folderPath = dirname(node.manifestCachePath);
  const manifestUrl = iiifManifestUrl(config, folderPath, node.id);

  // TODO: implement once IMMARKUS ID scheme is understood
  // Steps will be:
  //   1. Read node.manifestCachePath → parse with Cozy.parse()
  //      (handles v2 → v3 upgrade automatically)
  //   2. Read node.annotationsPath → W3C Web Annotation JSON array
  //   3. Build canvas ID mapping: IMMARKUS internal ID → new published canvas URL
  //      This requires replicating or inverting the IMMARKUS murmur hash scheme.
  //   4. Rewrite annotation target.source fields using the mapping
  //   5. Use cozy-iiif importAnnotations() to embed rewritten annotations
  //   6. Update manifest id + canvas ids to published URLs
  //   7. Write to iiifManifestOutputPath()

  console.warn(`  ⚠️  IIIF import [${node.id}] — skipped (not yet implemented)`);

  return manifestUrl;
}
