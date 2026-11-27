"use client"

import Image from "next/image"
import { useState } from "react"

export function AccountAvatar({ name, image, large = false }: { name: string; image?: string | null; large?: boolean }) {
  return <Avatar key={image ?? ""} name={name} image={image} large={large} />
}

function Avatar({ name, image, large }: { name: string; image?: string | null; large: boolean }) {
  const [failed, setFailed] = useState(false)
  const size = large ? 88 : 48
  return <span className={`vendor-avatar profile-avatar${large ? " profile-avatar-large" : ""}`}>
    {image && !failed
      ? <Image src={image} alt="" width={size} height={size} unoptimized referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      : <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "W"}</span>}
  </span>
}
