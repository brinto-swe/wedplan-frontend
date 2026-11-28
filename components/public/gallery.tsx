"use client"

import { useState } from "react"
import { ServicePhoto } from "./service-photo"

export function Gallery({ images }: { images: { image: string; alt: string; fallback: string }[] }) {
  const [selected, setSelected] = useState(0)
  const current = images[selected]
  return <figure className="wp-gallery">
    <div className="wp-gallery-main"><ServicePhoto src={current.image} fallback={current.fallback} alt={current.alt} fill sizes="(max-width: 760px) 100vw, 62vw" preload={selected === 0} /></div>
    {images.length > 1 && <div className="wp-thumbnails" aria-label="Gallery images">
      {images.map((image, index) => <button type="button" key={image.image} aria-pressed={index === selected} aria-label={image.alt} onClick={() => setSelected(index)}>
        <ServicePhoto src={image.image} fallback={image.fallback} alt="" fill sizes="(max-width: 760px) 33vw, 19vw" />
      </button>)}
    </div>}
    <figcaption>{images[0].image === images[0].fallback ? "Illustrative wedding photography" : "Service photography"}</figcaption>
  </figure>
}
