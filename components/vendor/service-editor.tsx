"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type FormEvent } from "react"
import { Check, ImageIcon } from "lucide-react"
import { getVendorService, saveVendorService, serviceInput, VendorApiError, type VendorService } from "@/lib/vendor-services"
import { LoadingState, RequestError, useVendor, vendorServicesKey } from "./workspace"

import { VendorBanner } from "./presentation"

function EditorForm({ service }: { service?: VendorService }) {
  const { profile } = useVendor()
  const router = useRouter()
  const client = useQueryClient()
  const [issues, setIssues] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const mutation = useMutation({
    mutationFn: (values: Parameters<typeof saveVendorService>[0]) => saveVendorService(values, service?.id),
    onSuccess: (result) => {
      setSaved(true)
      client.setQueryData(["vendor-service", profile.id, result.id], result)
      void client.invalidateQueries({ queryKey: vendorServicesKey(profile.id) })
      router.push("/vendor/services")
    },
  })

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (mutation.isPending || saved) return
    mutation.reset()
    const values = new FormData(event.currentTarget)
    const price = String(values.get("price") ?? "").trim()
    const parsed = serviceInput.safeParse({
      title: values.get("title"), category: values.get("category"), description: values.get("description"),
      location: values.get("location"), price: price ? Number(price) : NaN, isActive: values.get("status") === "active",
    })
    if (!parsed.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message
      setIssues(errors)
      const first = event.currentTarget.elements.namedItem(Object.keys(errors)[0])
      if (first instanceof HTMLElement) first.focus()
      return
    }
    setIssues({})
    mutation.mutate(parsed.data)
  }

  const error = mutation.error
  const messages = { ...(error instanceof VendorApiError ? error.fields : {}), ...issues }
  const invalid = (field: string) => ({ "aria-invalid": Boolean(messages[field]), "aria-describedby": messages[field] ? `${field}-error` : undefined })
  const fieldError = (field: string) => messages[field] && <p className="vendor-field-error" id={`${field}-error`}>{messages[field]}</p>

  return <form method="post" className="vendor-card vendor-form" noValidate onSubmit={submit}>
    <div className="vendor-editor-grid"><fieldset disabled={mutation.isPending || saved}>
      <legend>Service Information</legend>
      <div className="vendor-form-grid">
        <label className="vendor-field-wide">Service title<input name="title" defaultValue={service?.title} maxLength={120} required {...invalid("title")} />{fieldError("title")}</label>
        <label>Category<input name="category" defaultValue={service?.category} maxLength={80} placeholder="e.g. Photography" required {...invalid("category")} />{fieldError("category")}</label>
        <label>Location<input name="location" defaultValue={service?.location} maxLength={120} placeholder="City or region" required {...invalid("location")} />{fieldError("location")}</label>
        <label>Price<input name="price" defaultValue={service?.price} type="number" inputMode="decimal" min={0} max={1_000_000_000} step="any" required {...invalid("price")} />{fieldError("price")}</label>
        <label className="vendor-field-wide">Description<textarea name="description" defaultValue={service?.description} rows={6} maxLength={5000} placeholder="Describe what’s included, the service duration, and any requirements." required {...invalid("description")} />{fieldError("description")}</label>
      </div>
      <div className="vendor-media"><ImageIcon size={23} aria-hidden="true" /><div><h3>Service images</h3><p>Image uploads are unavailable for service listings. You can save your listing and add photos when uploads are supported.</p></div></div>
    </fieldset>
    <aside className="vendor-editor-aside"><fieldset disabled={mutation.isPending || saved} className="vendor-card vendor-status"><legend>Service Status</legend>
      <label><input type="radio" name="status" value="active" defaultChecked={service?.isActive === true} />Publish as active</label><p>Visible in the public directory. Active service limits apply.</p>
      <label><input type="radio" name="status" value="inactive" defaultChecked={!service?.isActive} />Save as draft</label><p>Keep this service private until you’re ready to publish.</p>
    </fieldset><section className="vendor-card vendor-guidelines"><h2>Publishing Guidelines</h2><ul>{["Use a clear service title.", "Choose an accurate category.", "Check the price and location.", "Describe what’s included."].map((tip) => <li key={tip}><Check size={16} aria-hidden="true" />{tip}</li>)}</ul></section></aside></div>
    {Object.keys(issues).length > 0 && <p className="vendor-field-error" role="alert">Check the highlighted fields before saving.</p>}
    {error && <div role="alert" className="vendor-notice vendor-error">
      <p>{error instanceof VendorApiError ? error.message : "The request could not be confirmed. Check My Services before trying again."}</p>
      {error instanceof VendorApiError && error.status === 401 && <Link href="/sign-in">Sign in</Link>}
    </div>}
    <div className="vendor-actions">
      <button className="wp-button" type="submit" disabled={mutation.isPending || saved}>
        {saved ? "Saved" : mutation.isPending ? "Saving…" : service ? "Save changes" : "Create service"}
      </button>
      <Link className="wp-button wp-button-outline" href="/vendor/services">Cancel</Link>
    </div>
  </form>
}

export function ServiceEditor({ id }: { id?: string }) {
  const { profile } = useVendor()
  const existing = useQuery({
    queryKey: ["vendor-service", profile.id, id],
    enabled: Boolean(id),
    queryFn: ({ signal }) => getVendorService(id!, signal),
  })

  return <div className="vendor-stack vendor-editor">
    <VendorBanner title={id ? "Edit Service" : "Add New Service"} description={id ? "Update your listing details and visibility." : "List a new wedding service on WedPlan and reach more couples."} />
    {id && existing.isPending ? <LoadingState text="Loading service details…" />
      : id && existing.isError ? <RequestError error={existing.error} retry={() => void existing.refetch()} />
      : <EditorForm key={id ?? "new"} service={existing.data} />}
  </div>
}
