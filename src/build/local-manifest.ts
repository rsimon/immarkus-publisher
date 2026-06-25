import { IIIFBuilder } from '@iiif/builder';
import { getImageDimensions } from '../image.js';
import { copyFileToOutput, writeJSON } from '../writer.js';
import {
  localManifestUrl,
  localCanvasUrl,
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

/**
 * Build a IIIF Presentation 3 manifest for a single local image,
 * copy the image to the output directory, and write the manifest JSON.
 *
 * Annotations are not yet embedded here — that comes in a later step
 * once we have resolved the IMMARKUS ID scheme.
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

  const json = builder.toPresentation3({ id: manifestUrl, type: 'Manifest' });

  // Write manifest and copy image
  await writeJSON(localManifestOutputPath(config, node.path), json);
  await copyFileToOutput(node.path, imageFileOutputPath(config, node.path));

  return manifestUrl;
}
