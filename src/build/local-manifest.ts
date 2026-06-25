import { readFile } from 'fs/promises';
import { IIIFBuilder } from '@iiif/builder';
import { getImageDimensions } from '../image.js';
import { copyFileToOutput, writeJSON } from '../writer.js';
import {
  localManifestUrl,
  localCanvasUrl,
  localAnnotationPageUrl,
  imageFileUrl,
  imageFileOutputPath,
  localManifestOutputPath,
} from '../urls.js';
import type { Config } from '../config.js';
import type { LocalImageNode } from '../types.js';

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  tif: 'image/tiff',
  tiff: 'image/tiff',
};

/** W3C Web Annotation with IMMARKUS target shape */
interface W3CAnnotation {
  id: string;
  type: string;
  motivation?: string;
  body?: unknown;
  target: string | { source: string; selector?: unknown } | Array<unknown>;
}

/**
 * Return true for annotations that carry a spatial selector (shape annotations).
 * Metadata-only annotations (no selector) and relation annotations (string target)
 * are excluded — they have no meaningful representation in a IIIF viewer.
 */
function isShapeAnnotation(a: W3CAnnotation): boolean {
  if (typeof a.target === 'string' || Array.isArray(a.target)) return false;
  return a.target.selector != null;
}

/**
 * Read the IMMARKUS annotation sidecar and return only shape annotations,
 * with target.source rewritten from the filename to the published canvas URL.
 */
async function loadAnnotations(
  annotationsPath: string,
  filename: string,
  canvasUrl: string
): Promise<W3CAnnotation[]> {
  const raw = await readFile(annotationsPath, 'utf-8');
  const all: W3CAnnotation[] = JSON.parse(raw);

  return all
    .filter(isShapeAnnotation)
    .map((a) => {
      const target = a.target as { source: string; selector?: unknown };
      if (target.source !== filename) return a; // unexpected source, leave as-is
      return { ...a, target: { ...target, source: canvasUrl } };
    });
}

/**
 * Build a IIIF Presentation 3 manifest for a single local image,
 * copy the image to the output directory, and write the manifest JSON.
 * If an IMMARKUS annotation sidecar exists, the annotations are embedded
 * as an AnnotationPage on the canvas.
 *
 * Returns the manifest URL (for use in parent collection's items list).
 */
export async function buildLocalManifest(
  node: LocalImageNode,
  config: Config
): Promise<string> {
  const filename = `${node.name}.${node.ext}`;
  const manifestUrl = localManifestUrl(config, node.path);
  const canvasUrl = localCanvasUrl(config, node.path);
  const imageUrl = imageFileUrl(config, node.path, filename);
  const mimeType = MIME_TYPES[node.ext] ?? 'image/jpeg';

  const { width, height } = await getImageDimensions(node.path);

  const builder = new IIIFBuilder();

  const manifest = builder.createManifest(manifestUrl, (m) => {
    m.addLabel(node.name, config.language);

    m.createCanvas(canvasUrl, (canvas) => {
      canvas.width = width;
      canvas.height = height;
      canvas.addLabel(node.name, config.language);

      canvas.createAnnotation(`${canvasUrl}/painting/1`, {
        id: `${canvasUrl}/painting/1`,
        type: 'Annotation',
        motivation: 'painting',
        body: {
          id: imageUrl,
          type: 'Image',
          format: mimeType,
          width,
          height,
        },
      });
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json = builder.toPresentation3({ id: manifestUrl, type: 'Manifest' }) as any;

  // Embed annotations if a sidecar file exists
  if (node.annotationsPath) {
    try {
      const annotations = await loadAnnotations(
        node.annotationsPath,
        filename,
        canvasUrl
      );

      if (annotations.length > 0) {
        const canvas = json.items?.[0];
        if (canvas) {
          canvas.annotations = [
            {
              id: localAnnotationPageUrl(config, node.path),
              type: 'AnnotationPage',
              items: annotations,
            },
          ];
        }
      }
    } catch (err) {
      console.warn(
        `  ⚠️  Could not load annotations for ${filename}: ${(err as Error).message}`
      );
    }
  }

  // Write manifest and copy image
  await writeJSON(localManifestOutputPath(config, node.path), json);
  await copyFileToOutput(node.path, imageFileOutputPath(config, node.path));

  return manifestUrl;
}
