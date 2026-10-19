/**
 * Utility to crop images on client-side using Canvas.
 */
export const getCroppedImg = async (imageSrc, pixelCrop, maxDim = 1024, quality = 0.85) => {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  let targetWidth = Math.round(pixelCrop.width);
  let targetHeight = Math.round(pixelCrop.height);

  // Proportional resize if crop exceeds max dimension
  if (targetWidth > maxDim || targetHeight > maxDim) {
    if (targetWidth > targetHeight) {
      targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
      targetWidth = maxDim;
    } else {
      targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
      targetHeight = maxDim;
    }
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw the cropped portion of the image onto the canvas
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  // Return as an optimized WebP Blob (fallback to JPEG if browser lacks WebP encoding)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        canvas.toBlob((fallbackBlob) => {
          if (!fallbackBlob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          resolve(fallbackBlob);
        }, 'image/jpeg', quality);
      }
    }, 'image/webp', quality);
  });
};

const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
