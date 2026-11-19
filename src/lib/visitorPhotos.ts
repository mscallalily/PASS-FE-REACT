/** Leave room for two photos and form fields below a 1 MiB proxy limit. */
export const VISITOR_PHOTO_BYTES = 450 * 1024;

export async function prepareVisitorPhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    throw new Error('Choose a JPG or PNG photo up to 5 MB.');
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This photo cannot be opened. Choose another JPG or PNG.'));
      image.src = url;
    });
    if (file.size <= VISITOR_PHOTO_BYTES && image.naturalWidth * image.naturalHeight <= 20_000_000) return file;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Unable to prepare the photo. Please try another browser.');
    // Keep document text readable; never shrink below a 1400px long edge.
    for (const edge of [2400, 2000, 1700, 1400]) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.9, 0.84, 0.78]) {
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (blob && blob.size <= VISITOR_PHOTO_BYTES) {
          return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg', lastModified: file.lastModified });
        }
      }
    }
    throw new Error('This photo is too detailed to upload. Crop it around the license or vehicle, then try again.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function appendVisitorPhotos(body: FormData, license: File, vehicle: File): Promise<void> {
  const [preparedLicense, preparedVehicle] = await Promise.all([prepareVisitorPhoto(license), prepareVisitorPhoto(vehicle)]);
  body.append('driver_license_photo', preparedLicense);
  body.append('vehicle_photo', preparedVehicle);
}
