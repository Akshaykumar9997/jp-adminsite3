import { UserError } from './feedback'
export const MEDIA_ACCEPT = '.jpg,.jpeg,.png,.webp,.mp4,.glb'
export const LOGO_ACCEPT = '.svg,.webp,.png,.jpg,.jpeg'
export function validateFile(file: File, logo = false) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const allowed = logo
    ? ['svg', 'webp', 'png', 'jpg', 'jpeg']
    : ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'glb']
  if (!ext || !allowed.includes(ext))
    throw new UserError(
      logo
        ? 'Use SVG, WebP, JPG or PNG for a logo.'
        : 'Unsupported format. Use JPG, PNG, WebP, MP4/H.264 or GLB.',
    )
  const limit =
    ext === 'mp4' || ext === 'glb' ? 200 * 1024 * 1024 : 20 * 1024 * 1024
  if (!file.size)
    throw new UserError('This file is empty. Choose another file.')
  if (file.size > limit)
    throw new UserError(
      `This file exceeds the ${limit / 1024 / 1024} MB limit.`,
    )
  return ext
}
export async function prepareMedia(
  file: File,
  signal: AbortSignal,
  logo = false,
): Promise<{
  file: File
  kind: 'image' | 'video' | 'model_3d'
  width?: number
  height?: number
}> {
  const ext = validateFile(file, logo)
  signal.throwIfAborted()
  if (ext === 'glb') {
    const buffer = await file.arrayBuffer()
    signal.throwIfAborted()
    const view = new DataView(buffer)
    if (
      buffer.byteLength < 20 ||
      view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 ||
      view.getUint32(8, true) !== buffer.byteLength ||
      view.getUint32(16, true) !== 0x4e4f534a
    )
      throw new UserError(
        'This GLB file is invalid. Export a valid glTF 2.0 binary model.',
      )
    const length = view.getUint32(12, true)
    if (20 + length > buffer.byteLength)
      throw new UserError('The GLB file is incomplete.')
    let json: {
      asset?: { version?: string }
      buffers?: Array<{ uri?: string }>
      images?: Array<{ uri?: string }>
    }
    try {
      json = JSON.parse(new TextDecoder().decode(buffer.slice(20, 20 + length)))
    } catch {
      throw new UserError('The GLB metadata is invalid.')
    }
    if (
      json.asset?.version !== '2.0' ||
      [...(json.buffers ?? []), ...(json.images ?? [])].some(
        (item) => item.uri && !item.uri.startsWith('data:'),
      )
    )
      throw new UserError(
        'Use a self-contained GLB 2.0 file with embedded textures.',
      )
    return {
      file: new File([file], file.name, { type: 'model/gltf-binary' }),
      kind: 'model_3d',
    }
  }
  if (ext === 'mp4') {
    const decoder = new TextDecoder('latin1')
    const header = decoder.decode(await file.slice(0, 12).arrayBuffer())
    let h264 = false, incompatible = false, tail = ''
    // Bound memory for large videos; inspect sample-description markers, not arbitrary
    // codec-like strings in compressed frames. Playback validation below is authoritative.
    if (header.slice(4, 8) === 'ftyp') for (let offset = 0; offset < file.size; offset += 1024 * 1024) {
      signal.throwIfAborted()
      const chunk = tail + decoder.decode(await file.slice(offset, offset + 1024 * 1024).arrayBuffer())
      for (const match of chunk.matchAll(/stsd[\s\S]{12}(avc1|avc3|hvc1|hev1|vp09|av01|encv)/g)) {
        h264 ||= /avc1|avc3/.test(match[1])
        incompatible ||= !/avc1|avc3/.test(match[1])
      }
      tail = chunk.slice(-24)
    }
    if (!h264 || incompatible)
      throw new UserError(
        'Use an MP4 encoded with H.264. This installation does not include a video transcoder; export H.264 and retry.',
      )
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    try {
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => {
          clearTimeout(timer)
          signal.removeEventListener('abort', cancel)
          error ? reject(error) : resolve()
        }
        const cancel = () => finish(new DOMException('Cancelled', 'AbortError'))
        const timer = setTimeout(
          () =>
            finish(
              new UserError(
                'Video validation timed out. Try a smaller H.264 MP4.',
              ),
            ),
          15000,
        )
        video.onloadedmetadata = () =>
          finish(
            video.videoWidth > 0 && Number.isFinite(video.duration)
              ? undefined
              : new UserError('This MP4 does not contain a playable video.'),
          )
        video.onerror = () =>
          finish(
            new UserError(
              'This MP4 could not be played. Export a valid H.264 MP4 and retry.',
            ),
          )
        signal.addEventListener('abort', cancel, { once: true })
        video.src = url
      })
      signal.throwIfAborted()
    } finally {
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
    }
    return {
      file: new File([file], file.name, { type: 'video/mp4' }),
      kind: 'video',
    }
  }
  if (ext === 'svg') {
    const xml = new DOMParser().parseFromString(
      await file.text(),
      'image/svg+xml',
    )
    if (
      xml.querySelector('parsererror,script,foreignObject,iframe,style') ||
      Array.from(xml.querySelectorAll('*')).some((el) =>
        Array.from(el.attributes).some(
          (a) =>
            /^on/i.test(a.name) ||
            (/href$/i.test(a.name) && !a.value.startsWith('#')) ||
            /url\((?!#)/i.test(a.value),
        ),
      )
    )
      throw new UserError(
        'This SVG contains active or external content. Export a clean SVG or WebP logo.',
      )
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    signal.throwIfAborted()
    const scale = Math.min(
      1,
      1920 / Math.max(image.naturalWidth, image.naturalHeight),
    )
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(
                new UserError(
                  'The image could not be optimized. Choose a different image.',
                ),
              ),
        'image/webp',
        0.85,
      ),
    )
    signal.throwIfAborted()
    return {
      file: new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), {
        type: 'image/webp',
      }),
      kind: 'image',
      width: canvas.width,
      height: canvas.height,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}
