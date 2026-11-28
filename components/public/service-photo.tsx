"use client"

import Image, { type ImageProps } from "next/image"
import { useState } from "react"

type ServicePhotoProps = Omit<ImageProps, "src" | "onError" | "unoptimized"> & { src: string; fallback: string }

export function ServicePhoto({ src, ...props }: ServicePhotoProps) {
  return <Photo key={src} src={src} {...props} />
}

function Photo({ src, fallback, alt, ...props }: ServicePhotoProps) {
  const [failed, setFailed] = useState(false)
  return <Image {...props} src={failed ? fallback : src}
    alt={failed && alt ? "Illustrative wedding photography" : alt}
    unoptimized={!failed && src !== fallback} onError={() => setFailed(true)} />
}
