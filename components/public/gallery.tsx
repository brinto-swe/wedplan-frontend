"use client"

import { useState } from "react"
import Image from "next/image"

export function Gallery({ images }: { images: { image: string; alt: string }[] }) {
  const [selected, setSelected] = useState(0)
  const current = images[selected]
  return <figure className="wp-gallery">
    <div className="wp-gallery-main"><Image src={current.image} alt={current.alt} fill sizes="(max-width: 760px) 100vw, 62vw" preload={selected === 0} /></div>
    <div className="wp-thumbnails" aria-label="Gallery images">
      {images.map((image, index) => <button type="button" key={image.image} aria-pressed={index === selected} aria-label={image.alt} onClick={() => setSelected(index)}>
        <Image src={image.image} alt="" fill sizes="(max-width: 760px) 33vw, 19vw" />
      </button>)}
    </div>
    <figcaption>Illustrative wedding photography</figcaption>
  </figure>
}
