import { readFile } from 'fs/promises';
import type { Config } from '../config.js';
import type { IIIFImportNode } from '../types.js';
import { iiifManifestUrl, iiifManifestOutputPath } from '../urls.js';
import { writeJSON } from '../writer.js';
import { dirname } from 'path';

/** The shape IMMARKUS stores in _iiif.<id>.json descriptor files */
interface IIIFDescriptor {
  id: string;
  name: string;
  uri: string;
  importedAt: string;
  majorVersion: number;
  type: 'PRESENTATION_MANIFEST' | 'IIIF_IMAGE';
  canvases?: Array<{
    id: string;   // murmur.v3(canvasUri).toString()
    uri: string;  // original canvas URI
    name: string;
    manifestId: string;
  }>;
}

/** W3C Web Annotation as stored by IMMARKUS */
interface W3CAnnotation {
  id: string;
  type: string;
  motivation?: string;
  body?: unknown;
  target: string | { source: string; selector?: unknown } | Array<unknown>;
}

function isShapeAnnotation(a: W3CAnnotation): boolean {
  if (typeof a.target === 'string' || Array.isArray(a.target)) return false;
  return a.target.selector != null;
}

/**
 * Build a derivative IIIF manifest from an imported IMMARKUS IIIF resource.
 *
 * Steps:
 *   1. Read _iiif.<id>.json descriptor → get original manifest URI and canvas list
 *   2. Fetch the original manifest from the network (requires internet access at build time)
 *   3. Build canvas ID mapping: "iiif:manifestId:canvasHash" → original canvas URI
 *   4. Read _iiif.<id>.annotations.json → filter to shape annotations
 *   5. Rewrite annotation target.source to original canvas URI
 *   6. Embed annotations as AnnotationPage items on their canvases
 *   7. Update manifest id to the published URL; keep original canvas URIs
 *   8. Write to iiifManifestOutputPath()
 *
 * Returns the manifest URL (for use in parent collection's items list).
 */
export async function buildIIIFManifest(
  node: IIIFImportNode,
  config: Config
): Promise<string> {
  const folderPath = dirname(node.manifestCachePath);
  const publishedManifestUrl = iiifManifestUrl(config, folderPath, node.id);

  // Read descriptor
  let descriptor: IIIFDescriptor;
  try {
    const raw = await readFile(node.manifestCachePath, 'utf-8');
    descriptor = JSON.parse(raw) as IIIFDescriptor;
  } catch (err) {
    console.warn(
      `  ⚠️  [${node.name}] Could not read descriptor: ${(err as Error).message} — skipping`
    );
    return publishedManifestUrl;
  }

  if (descriptor.type !== 'PRESENTATION_MANIFEST') {
    console.warn(`  ⚠️  [${node.name}] IIIF Image resources are not yet supported — skipping`);
    return publishedManifestUrl;
  }

  // Fetch original manifest from network
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let manifestJson: any;
  try {
    const response = await fetch(descriptor.uri);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }
    manifestJson = await response.json();
  } catch (err) {
    console.warn(
      `  ⚠️  [${node.name}] Could not fetch manifest from ${descriptor.uri}: ${(err as Error).message} — skipping`
    );
    return publishedManifestUrl;
  }

  // Only IIIF v3 is fully supported; v2 support can be added later via cozy-iiif upgrade
  const majorVersion = descriptor.majorVersion;
  if (majorVersion !== 3) {
    console.warn(
      `  ⚠️  [${node.name}] IIIF Presentation v${majorVersion} manifests are not yet supported (only v3) — skipping`
    );
    return publishedManifestUrl;
  }

  // Build mapping: "iiif:manifestId:canvasHash" → original canvas URI
  const canvasUriMap = new Map<string, string>();
  for (const canvas of descriptor.canvases ?? []) {
    const key = `iiif:${descriptor.id}:${canvas.id}`;
    canvasUriMap.set(key, canvas.uri);
  }

  // Read and rewrite annotations if present
  const annotationsByCanvas = new Map<string, W3CAnnotation[]>();

  if (node.annotationsPath) {
    try {
      const raw = await readFile(node.annotationsPath, 'utf-8');
      const allAnnotations: W3CAnnotation[] = JSON.parse(raw);

      for (const annotation of allAnnotations) {
        if (!isShapeAnnotation(annotation)) continue;

        const target = annotation.target as { source: string; selector?: unknown };
        const originalCanvasUri = canvasUriMap.get(target.source);
        if (!originalCanvasUri) continue; // unknown canvas, skip

        const rewritten: W3CAnnotation = {
          ...annotation,
          target: { ...target, source: originalCanvasUri },
        };

        const group = annotationsByCanvas.get(originalCanvasUri) ?? [];
        group.push(rewritten);
        annotationsByCanvas.set(originalCanvasUri, group);
      }
    } catch (err) {
      console.warn(
        `  ⚠️  [${node.name}] Could not load annotations: ${(err as Error).message}`
      );
    }
  }

  // Clone the raw v3 manifest JSON so we can mutate it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manifestOut: any = JSON.parse(JSON.stringify(manifestJson));

  // Update the manifest's own id to the published URL
  manifestOut.id = publishedManifestUrl;

  // Embed annotations into canvases (canvas IDs remain the original institution URIs)
  if (annotationsByCanvas.size > 0 && Array.isArray(manifestOut.items)) {
    let pageCounter = 1;
    for (const canvas of manifestOut.items) {
      const canvasAnnotations = annotationsByCanvas.get(canvas.id);
      if (!canvasAnnotations || canvasAnnotations.length === 0) continue;

      canvas.annotations = [
        ...(canvas.annotations ?? []),
        {
          id: `${publishedManifestUrl}/annotations/${pageCounter++}`,
          type: 'AnnotationPage',
          items: canvasAnnotations,
        },
      ];
    }
  }

  await writeJSON(iiifManifestOutputPath(config, folderPath, node.id), manifestOut);

  return publishedManifestUrl;
}
