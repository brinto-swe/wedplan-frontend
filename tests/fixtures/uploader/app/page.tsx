"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ImageUploader } from "@/components/ui/image-uploader"

function UploaderFixture() {
  const [value, setValue] = useState<string[]>([])
  const single = useSearchParams().get("single") === "1"
  return <ImageUploader value={value} onChange={setValue} multiple={!single} />
}

export default function Fixture() {
  return <Suspense><UploaderFixture /></Suspense>
}
