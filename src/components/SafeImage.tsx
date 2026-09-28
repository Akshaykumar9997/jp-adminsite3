import { ImageOff } from 'lucide-react'
import { useState, type ImgHTMLAttributes } from 'react'

export function SafeImage({ className = '', alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span className={`image-fallback ${className}`} role="img" aria-label={alt || 'Image unavailable'}><ImageOff size={18} /></span>
  }

  return <img className={className} alt={alt} {...props} onError={() => setFailed(true)} />
}
