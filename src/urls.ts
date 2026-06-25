import { relative } from 'path';
import type { Config } from './config.js';

/**
 * All URL construction lives here so the scheme is consistent and
 * easy to change in one place.
 *
 * Output layout (relative to baseUrl):
 *
 *   /collection.json                        ← root collection
 *   /collection/<rel-path>/collection.json  ← sub-collection per subfolder
 *   /manifest/<rel-path>/manifest.json      ← manifest per image or IIIF import
 *   /canvas/<rel-path>/canvas/<n>           ← canvas IDs within a manifest
 *   /images/<rel-path>/<filename>           ← copied local image files
 */

/** Root IIIF Collection */
export function rootCollectionUrl(config: Config): string {
  return `${config.baseUrl}/collection.json`;
}

/**
 * IIIF Collection URL for a subfolder.
 * @param folderPath  Absolute path to the folder
 */
export function collectionUrl(config: Config, folderPath: string): string {
  const rel = relative(config.sourceDir, folderPath);
  return `${config.baseUrl}/collection/${rel}/collection.json`;
}

/**
 * IIIF Manifest URL for a local image.
 * @param imagePath  Absolute path to the image file
 */
export function localManifestUrl(config: Config, imagePath: string): string {
  const rel = relative(config.sourceDir, imagePath);
  return `${config.baseUrl}/manifest/${rel}/manifest.json`;
}

/**
 * Canvas URL within a local-image manifest.
 * We only ever have one canvas per local image.
 */
export function localCanvasUrl(config: Config, imagePath: string): string {
  const rel = relative(config.sourceDir, imagePath);
  return `${config.baseUrl}/manifest/${rel}/canvas/1`;
}

/**
 * Annotation page URL for IMMARKUS annotations on a local image canvas.
 */
export function localAnnotationPageUrl(config: Config, imagePath: string): string {
  const rel = relative(config.sourceDir, imagePath);
  return `${config.baseUrl}/manifest/${rel}/canvas/1/annotations/1`;
}

/**
 * Public URL for a copied local image file.
 */
export function imageFileUrl(
  config: Config,
  imagePath: string,
  filename: string
): string {
  const rel = relative(config.sourceDir, imagePath);
  // imagePath includes the filename; get the directory part
  const dir = rel.split('/').slice(0, -1).join('/');
  const prefix = dir ? `${dir}/` : '';
  return `${config.baseUrl}/images/${prefix}${filename}`;
}

/**
 * IIIF Manifest URL for an imported IIIF resource.
 * @param folderPath  The folder the _iiif.*.json file lives in
 * @param id          The IMMARKUS internal ID (the hash portion of the filename)
 */
export function iiifManifestUrl(
  config: Config,
  folderPath: string,
  id: string
): string {
  const rel = relative(config.sourceDir, folderPath);
  const prefix = rel ? `${rel}/` : '';
  return `${config.baseUrl}/manifest/${prefix}${id}/manifest.json`;
}

/**
 * Output filesystem paths (parallel to the URL scheme above, but under outputDir).
 */

export function rootCollectionOutputPath(config: Config): string {
  return `${config.outputDir}/collection.json`;
}

export function collectionOutputPath(config: Config, folderPath: string): string {
  const rel = relative(config.sourceDir, folderPath);
  return `${config.outputDir}/collection/${rel}/collection.json`;
}

export function localManifestOutputPath(config: Config, imagePath: string): string {
  const rel = relative(config.sourceDir, imagePath);
  return `${config.outputDir}/manifest/${rel}/manifest.json`;
}

export function iiifManifestOutputPath(
  config: Config,
  folderPath: string,
  id: string
): string {
  const rel = relative(config.sourceDir, folderPath);
  const prefix = rel ? `${rel}/` : '';
  return `${config.outputDir}/manifest/${prefix}${id}/manifest.json`;
}

export function imageFileOutputPath(config: Config, imagePath: string): string {
  const rel = relative(config.sourceDir, imagePath);
  return `${config.outputDir}/images/${rel}`;
}
