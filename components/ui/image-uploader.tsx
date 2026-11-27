"use client"

import { useEffect, useId, useRef, useState, type DragEvent } from "react"
import { Upload } from "lucide-react"
import { toast } from "sonner"
import { imageTypes, maxImageBytes, uploadImage } from "@/lib/image-uploads"
import { Button } from "./button"
import { LoadingLabel } from "./loading-label"

type ImageUploaderProps = {
  value: readonly string[]
  onChange: (urls: string[]) => void
  maxImages?: number
  disabled?: boolean
  multiple?: boolean
}

type Selection = {
  id: string
  file: File
  preview: string
  status: "queued" | "uploading" | "failed"
  error?: string
}

const fingerprint = (file: File) => JSON.stringify([file.name, file.size, file.lastModified])

// Native img supports local blob previews and caller-provided hosted images.
function Preview({ src, alt }: { src: string; alt: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className="aspect-square w-full rounded-md bg-muted object-cover" />
}

export function ImageUploader({ value, onChange, maxImages = 10, disabled = false, multiple = true }: ImageUploaderProps) {
  const hintId = useId()
  const input = useRef<HTMLInputElement>(null)
  const active = useRef<AbortController | null>(null)
  const previews = useRef(new Set<string>())
  const uploadedFiles = useRef(new Map<string, string>())
  const latest = useRef({ value, onChange })
  const [selections, setSelections] = useState<Selection[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const limit = Math.max(0, Math.min(multiple ? 10 : 1, Number.isFinite(maxImages) ? Math.floor(maxImages) : 10))
  const remaining = Math.max(0, limit - value.length - selections.length)
  const canSelect = !disabled && !busy && remaining > 0

  useEffect(() => { latest.current = { value, onChange } }, [value, onChange])
  useEffect(() => {
    const urls = previews.current
    return () => {
      active.current?.abort()
      active.current = null
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  function release(preview: string) {
    URL.revokeObjectURL(preview)
    previews.current.delete(preview)
  }

  function publish(urls: string[]) {
    latest.current.value = urls
    latest.current.onChange(urls)
  }

  async function upload(files: Selection[]) {
    if (disabled || active.current || files.length === 0) return
    const controller = new AbortController()
    active.current = controller
    setBusy(true)
    try {
      for (const item of files) {
        if (controller.signal.aborted) return
        setSelections((rows) => rows.map((row) => row.id === item.id ? { ...row, status: "uploading", error: undefined } : row))
        let url: string
        try {
          url = await uploadImage(item.file, controller.signal)
        } catch (error) {
          if (controller.signal.aborted) return
          const message = error instanceof TypeError ? "Could not reach the upload service. Try again."
            : error instanceof DOMException ? "The upload timed out. Try again."
              : error instanceof Error ? error.message : "Could not upload this image. Try again."
          toast.error(`${item.file.name}: ${message}`)
          setSelections((rows) => rows.map((row) => row.id === item.id ? { ...row, status: "failed", error: message } : row))
          continue
        }
        if (controller.signal.aborted) return
        const current = latest.current.value
        uploadedFiles.current.set(item.id, url)
        if (!current.includes(url)) publish([...current, url])
        setSelections((rows) => rows.filter((row) => row.id !== item.id))
        release(item.preview)
      }
    } finally {
      if (active.current === controller) {
        active.current = null
        setBusy(false)
      }
    }
  }

  function select(files: File[]) {
    if (!canSelect || active.current || !files.length) return
    const known = new Set(selections.map(({ id }) => id))
    for (const [id, url] of uploadedFiles.current) {
      if (value.includes(url)) known.add(id)
      else uploadedFiles.current.delete(id)
    }
    const accepted: Selection[] = []
    const errors: string[] = []
    for (const file of files) {
      if (accepted.length >= remaining) {
        errors.push(`You can add up to ${limit} ${limit === 1 ? "image" : "images"}.`)
        break
      }
      const id = fingerprint(file)
      if (known.has(id)) { errors.push(`${file.name} is already selected.`); continue }
      if (!imageTypes.some((type) => type === file.type)) { errors.push(`${file.name}: Choose a JPEG, PNG, or WebP image.`); continue }
      if (file.size === 0) { errors.push(`${file.name} is empty.`); continue }
      if (file.size > maxImageBytes) { errors.push(`${file.name}: Images must be at most 4 MiB.`); continue }
      const preview = URL.createObjectURL(file)
      previews.current.add(preview)
      known.add(id)
      accepted.push({ id, file, preview, status: "queued" })
    }
    if (errors.length) toast.error(errors[0], { description: errors.length > 1 ? `${errors.length - 1} more selection issues.` : undefined })
    if (!accepted.length) return
    setSelections((rows) => [...rows, ...accepted])
    void upload(accepted)
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    select(Array.from(event.dataTransfer.files))
  }

  return <section aria-label="Image uploader" className="grid min-w-0 gap-4">
    <div className={`grid justify-items-center gap-2 rounded-xl border border-dashed p-5 text-center ${dragging ? "border-primary bg-secondary" : "border-border bg-card"}`}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = canSelect ? "copy" : "none"; setDragging(canSelect) }}
      onDragLeave={() => setDragging(false)} onDrop={drop}>
      <input ref={input} type="file" accept={imageTypes.join(",")} multiple={multiple && limit > 1} hidden disabled={!canSelect}
        onChange={(event) => { select(Array.from(event.currentTarget.files ?? [])); event.currentTarget.value = "" }} />
      <Button type="button" variant="outline" disabled={!canSelect} aria-describedby={hintId} onClick={() => input.current?.click()}>
        <Upload aria-hidden="true" />{limit === 1 ? "Choose image" : "Choose images"}
      </Button>
      <p id={hintId} className="text-sm text-muted-foreground">Drop files here, or use the file picker. JPEG, PNG or WebP, up to 4 MiB each.</p>
      <p role="status" className="text-sm text-muted-foreground">{value.length} uploaded · {remaining} available</p>
    </div>
    {(value.length > 0 || selections.length > 0) && <ul aria-label="Image previews" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {value.map((url, index) => <li key={url} className="grid min-w-0 gap-2 rounded-xl border bg-card p-2">
        <Preview src={url} alt={`Uploaded image ${index + 1}`} />
        <p className="text-sm">Uploaded</p>
        <Button type="button" variant="outline" disabled={disabled || busy} aria-label={`Remove uploaded image ${index + 1}`}
          onClick={() => publish(value.filter((_, position) => position !== index))}>Remove</Button>
      </li>)}
      {selections.map((item) => <li key={item.id} className="grid min-w-0 gap-2 rounded-xl border bg-card p-2">
        <Preview src={item.preview} alt={`Preview of ${item.file.name}`} />
        <p className="break-all text-sm">{item.file.name}</p>
        {item.status === "uploading" ? <LoadingLabel>Uploading…</LoadingLabel>
          : item.status === "failed" ? <p className="break-words text-sm text-destructive" role="status">{item.error}</p>
            : <p className="text-sm text-muted-foreground">Waiting to upload</p>}
        {item.status === "failed" && <Button type="button" variant="secondary" disabled={disabled || busy}
          aria-label={`Retry ${item.file.name}`} onClick={() => void upload([item])}>Retry</Button>}
        <Button type="button" variant="outline" disabled={disabled || busy} aria-label={`Remove ${item.file.name}`}
          onClick={() => { release(item.preview); setSelections((rows) => rows.filter(({ id }) => id !== item.id)) }}>Remove</Button>
      </li>)}
    </ul>}
  </section>
}
