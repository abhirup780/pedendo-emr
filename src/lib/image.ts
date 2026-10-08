/** Longest edge, in pixels, of a stored photograph. Enough for clinical review, about 300 KB. */
export const MAX_EDGE = 1600

export function fitWithin(width: number, height: number, maxEdge: number = MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height)
  if (longest <= maxEdge || longest === 0) return { width, height }
  const k = maxEdge / longest
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) }
}

/**
 * Shrinks a photo in the browser before upload: resized to MAX_EDGE, re-encoded as JPEG.
 * Re-encoding also drops the camera's embedded details such as GPS location.
 */
export async function compressImage(file: Blob, maxEdge: number = MAX_EDGE, quality = 0.8): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const size = fitWithin(bitmap.width, bitmap.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process images.')
  // JPEG has no transparency: paint white first so transparent areas do not turn black.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, size.width, size.height)
  ctx.drawImage(bitmap, 0, 0, size.width, size.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) throw new Error('The photo could not be converted.')
  return { blob, ...size }
}

/**
 * A logo or signature for the letterhead: shrunk to fit and returned as a PNG data URL, small
 * enough to keep in the settings row. Transparency is kept so a signature sits on the paper.
 */
export async function smallImageDataUrl(file: Blob, maxWidth: number, maxHeight: number): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const k = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * k))
  canvas.height = Math.max(1, Math.round(bitmap.height * k))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser cannot process images.')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL('image/png')
  if (url.length > 350000) throw new Error('This image is too detailed to store. Use a simpler or smaller one.')
  return url
}
