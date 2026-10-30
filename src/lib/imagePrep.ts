import { MAX_FILE_MB } from '../components/FileUpload';

/** The server reads images up to 20 megapixels (LicenseDocumentReader). */
const MAX_PIXELS = 20_000_000;
const MAX_EDGE = 4000;

/**
 * Keeps a phone photo uploadable without degrading its text. The original
 * file is returned unchanged whenever it is within the size and pixel limits.
 * Only a larger photo is re-encoded once, upright (EXIF orientation applied),
 * at high JPEG quality and no more than 4000 px on its long edge, which is
 * still far above what the license text needs.
 */
export async function fitPhotoForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // Let the server report a file it cannot decode.
  }
  const { width, height } = bitmap;
  if (file.size <= MAX_FILE_MB * 1024 * 1024 && width * height <= MAX_PIXELS) {
    bitmap.close();
    return file;
  }
  let scale = Math.min(1, MAX_EDGE / Math.max(width, height), Math.sqrt(MAX_PIXELS / (width * height)));
  for (const quality of [0.92, 0.88, 0.85]) {
    const blob = await draw(bitmap, scale, quality);
    if (blob && blob.size <= MAX_FILE_MB * 1024 * 1024) {
      bitmap.close();
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
    }
    scale *= 0.85;
  }
  bitmap.close();
  return file; // Still too large: the normal size message applies.
}

function draw(bitmap: ImageBitmap, scale: number, quality: number): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d');
  if (!context) return Promise.resolve(null);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
}
