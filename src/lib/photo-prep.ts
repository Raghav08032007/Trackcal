// Shrink a meal photo before it is uploaded for an AI estimate: longest side at most 1024 px, re-encoded as JPEG.
// Drawing onto a canvas keeps only pixels, so EXIF metadata (GPS position, device, time) is not sent.
// The server repeats this (backend/services/photo_prep.py), so browsers without createImageBitmap send the original.
export const MAX_PHOTO_SIDE = 1024;

export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

function readAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
  });
}

export async function preparePhoto(file: File): Promise<string> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return readAsDataUrl(file);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("Couldn't read this photo. Try another one or log the meal manually."); }
  try {
    const size = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas"); canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return readAsDataUrl(file);
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally { bitmap.close(); }
}
