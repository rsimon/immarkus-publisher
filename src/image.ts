import sharp from 'sharp';

export interface ImageDimensions {
  width: number;
  height: number;
}

/**
 * Read the pixel dimensions of a local image file.
 * sharp handles JPEG, PNG, TIFF and more without loading the full image.
 */
export async function getImageDimensions(imagePath: string): Promise<ImageDimensions> {
  const metadata = await sharp(imagePath).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`Could not read dimensions from image: ${imagePath}`);
  }

  return { width: metadata.width, height: metadata.height };
}
