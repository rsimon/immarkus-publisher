/**
 * The scanner produces a tree of these nodes, mirroring the IMMARKUS
 * folder structure. Each node type maps to a IIIF resource:
 *
 *   FolderNode        → IIIF Collection
 *   LocalImageNode    → IIIF Manifest (image served as static file)
 *   IIIFImportNode    → IIIF Manifest (derivative of an imported manifest)
 */

export interface FolderNode {
  type: 'folder';
  /** Absolute path to this directory */
  path: string;
  /** Folder name (used as label fallback) */
  name: string;
  /** Parsed _immarkus.folder.meta.json, if present */
  meta: Record<string, unknown> | null;
  children: SourceNode[];
}

export interface LocalImageNode {
  type: 'localImage';
  /** Absolute path to the image file */
  path: string;
  /** Filename without extension, used to build URLs */
  name: string;
  /** File extension: 'jpg' | 'jpeg' | 'png' | 'tif' | 'tiff' */
  ext: string;
}

export interface IIIFImportNode {
  type: 'iiifImport';
  /**
   * Absolute path to the _iiif.<id>.json file IMMARKUS wrote when
   * the manifest was imported. Contains the original manifest JSON
   * (or a reference to it).
   */
  manifestCachePath: string;
  /**
   * Absolute path to the _iiif.<id>.annotations.json file, if it exists.
   * May be absent if the user imported the manifest but made no annotations.
   */
  annotationsPath: string | null;
  /** The <id> portion of the filename (used to key everything) */
  id: string;
}

export type SourceNode = FolderNode | LocalImageNode | IIIFImportNode;
