import type { ObjectDetection } from '@tensorflow-models/coco-ssd';

export type VehicleDetection = { bbox: [number, number, number, number]; class: string; score: number };
export type VehicleSuggestions = { plate_number?: string; color?: string; category?: 'motorcycle' | 'car' };
let detector: Promise<ObjectDetection> | null = null;
let queue: Promise<unknown> = Promise.resolve();

async function loadDetector() {
  if (!detector) detector = (async () => {
    const tf = await import('@tensorflow/tfjs-core');
    await Promise.all([import('@tensorflow/tfjs-backend-cpu'), import('@tensorflow/tfjs-backend-webgl')]);
    try { if (!(await tf.setBackend('webgl'))) await tf.setBackend('cpu'); } catch { await tf.setBackend('cpu'); }
    await tf.ready();
    const coco = await import('@tensorflow-models/coco-ssd');
    return coco.load({ base: 'lite_mobilenet_v2', modelUrl: '/models/vehicle-detector/model.json' });
  })().catch(error => { detector = null; throw error; });
  return detector;
}

export async function loadVehiclePhoto(file: File): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 20_000_000) throw new Error('Use a photo with at most 20 megapixels.');
    const ratio = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(image.naturalWidth * ratio); canvas.height = Math.round(image.naturalHeight * ratio);
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height); return canvas;
  } finally { URL.revokeObjectURL(url); }
}

export async function detectVehicles(photo: HTMLCanvasElement): Promise<VehicleDetection[]> {
  const run = queue.catch(() => {}).then(async () => {
    const model = await loadDetector();
    const results = await model.detect(photo, 12, .55);
    return results.filter(d => ['car', 'motorcycle', 'truck'].includes(d.class) && d.score >= .65 && d.bbox[2] * d.bbox[3] >= photo.width * photo.height * .03)
      .sort((a, b) => b.bbox[2] * b.bbox[3] - a.bbox[2] * a.bbox[3]);
  });
  queue = run; return run;
}

export function detectedCategory(detection?: VehicleDetection | null): VehicleSuggestions['category'] {
  return detection?.class === 'motorcycle' ? 'motorcycle' : detection?.class === 'car' ? 'car' : undefined;
}

function colorName(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), difference = max - min, saturation = max ? difference / max : 0;
  if (max < 55) return 'Black';
  if (saturation < .18) return max > 190 ? 'White' : 'Gray';
  let hue = difference ? max === r ? ((g - b) / difference) % 6 : max === g ? (b - r) / difference + 2 : (r - g) / difference + 4 : 0;
  hue = (hue * 60 + 360) % 360;
  if (hue < 18 || hue >= 345) return 'Red';
  if (hue < 42) return max < 165 ? 'Brown' : 'Orange';
  if (hue < 72) return 'Yellow';
  if (hue < 170) return 'Green';
  if (hue < 260) return 'Blue';
  return 'Purple';
}

/** Coarse estimate from the central body region; never an identity/access decision. */
export function estimateVehicleColor(photo: HTMLCanvasElement, detection: VehicleDetection): { color: string | null; share: number } {
  const [x, y, width, height] = detection.bbox;
  const patch = document.createElement('canvas'); patch.width = 120; patch.height = 60;
  const ctx = patch.getContext('2d')!;
  const motorcycle = detection.class === 'motorcycle';
  ctx.drawImage(photo, Math.max(0, x + width * (motorcycle ? .2 : .18)), Math.max(0, y + height * (motorcycle ? .22 : .36)), Math.max(1, width * (motorcycle ? .6 : .64)), Math.max(1, height * .30), 0, 0, 120, 60);
  const pixels = ctx.getImageData(0, 0, 120, 60).data, counts: Record<string, number> = {};
  for (let i = 0; i < pixels.length; i += 4) { const color = colorName(pixels[i], pixels[i + 1], pixels[i + 2]); counts[color] = (counts[color] || 0) + 1; }
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const colored = ranked.find(([c, count]) => !['Black', 'White', 'Gray'].includes(c) && count / 7200 >= (motorcycle ? .18 : .3));
  const [color, count] = colored || ranked[0]; const share = count / 7200;
  return { color: share >= (colored && motorcycle ? .18 : .3) ? color : null, share };
}

export function vehicleCrop(photo: HTMLCanvasElement, detection?: VehicleDetection | null): Promise<File> {
  const [x, y, width, height] = detection?.bbox || [0, 0, photo.width, photo.height];
  const crop = document.createElement('canvas'); crop.width = Math.max(1, Math.round(width)); crop.height = Math.max(1, Math.round(height));
  crop.getContext('2d')!.drawImage(photo, x, y, width, height, 0, 0, crop.width, crop.height);
  return new Promise((resolve, reject) => crop.toBlob(blob => blob ? resolve(new File([blob], 'vehicle-read.jpg', { type: 'image/jpeg' })) : reject(new Error('Unable to read the selected vehicle.')), 'image/jpeg', .95));
}
