"use client"

import { useState, type FormEvent } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { Camera, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AccountAvatar } from "@/components/ui/account-avatar"
import { ImageUploader } from "@/components/ui/image-uploader"
import { UiIcon } from "@/components/ui/icon"
import { VendorBanner } from "@/components/vendor/presentation"
import { authClient } from "@/lib/auth"
import { profileChanges, profileKey, ProfileError, updateProfile, type AccountProfile } from "@/lib/profile"

const formatDate = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" })

export function ProfileSettings({ profile, plan }: { profile: AccountProfile; plan?: string }) {
  return <ProfileForm key={profile.id} profile={profile} plan={plan} />
}

function ProfileForm({ profile, plan }: { profile: AccountProfile; plan?: string }) {
  const role = profile.role === "vendor" ? "vendor" : "customer"
  const roleLabel = role === "vendor" ? "Vendor" : "Customer"
  const [name, setName] = useState(profile.name)
  const [businessName, setBusinessName] = useState(profile.businessName ?? "")
  const [image, setImage] = useState(profile.image)
  const [uploading, setUploading] = useState(false)
  const [resetId, setResetId] = useState(0)
  const [issues, setIssues] = useState<Record<string, string>>({})
  const client = useQueryClient()
  const session = authClient.useSession()
  const save = useMutation({
    mutationFn: async (changes: Parameters<typeof updateProfile>[0]) => {
      const updated = await updateProfile(changes)
      if (updated.id !== profile.id || updated.role !== profile.role) throw new ProfileError(403)
      return updated
    },
    onSuccess(updated) {
      client.setQueryData(profileKey(role, profile.id), updated)
      setName(updated.name)
      setImage(updated.image)
      setBusinessName(updated.businessName ?? "")
      void session.refetch()
    },
  })
  const busy = uploading || save.isPending
  const problems = save.error instanceof ProfileError ? { ...issues, ...save.error.fields } : issues

  function reset() {
    setName(profile.name)
    setBusinessName(profile.businessName ?? "")
    setImage(profile.image)
    setResetId((value) => value + 1)
    setIssues({})
    save.reset()
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    save.reset()
    // An unchanged OAuth avatar can be retained without re-submitting its URL.
    const parsed = profileChanges.safeParse({
      name, ...(image !== profile.image && { image }), ...(role === "vendor" && { businessName }),
    })
    if (!parsed.success) {
      setIssues(Object.fromEntries(parsed.error.issues.map(({ path, message }) => [String(path[0]), message])))
      return
    }
    setIssues({})
    save.mutate(parsed.data)
  }

  const invalid = (field: string) => ({
    "aria-invalid": Boolean(problems[field]), "aria-describedby": problems[field] ? `profile-${field}-error` : undefined,
  })
  const issue = (field: string) => problems[field] && <span id={`profile-${field}-error`} className="vendor-field-error" role="alert">{problems[field]}</span>

  return <div className="vendor-stack">
    <VendorBanner title="Profile Settings" description={role === "vendor"
      ? "Manage your business name, personal information, and profile photo."
      : "Manage your personal information and profile photo."} />
    <form className="profile-settings vendor-form" aria-label="Profile settings" onSubmit={submit} noValidate>
      <div className="profile-settings-main vendor-card">
        <fieldset disabled={save.isPending}>
          <legend><UiIcon icon={UserRound} size="sm" /> Personal Information</legend>
          <div className="vendor-form-grid">
            <label className="vendor-field-wide">Full name
              <input name="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} required {...invalid("name")} />
              {issue("name")}
            </label>
            {role === "vendor" && <label className="vendor-field-wide">Business name
              <input name="businessName" value={businessName} onChange={(event) => setBusinessName(event.target.value)} autoComplete="organization" maxLength={120} {...invalid("businessName")} />
              {issue("businessName")}
            </label>}
            <label>Email address<input type="email" value={profile.email} readOnly /></label>
            <label>Role<input value={roleLabel} readOnly /></label>
          </div>
        </fieldset>
        {save.error && <div className="vendor-notice vendor-error" role="alert">
          <p>{save.error instanceof ProfileError ? save.error.message : "We couldn’t save your profile. Please try again."}</p>
          {save.error instanceof ProfileError && save.error.status === 401 && <Link href="/sign-in">Sign in</Link>}
        </div>}
        {save.isSuccess && <p className="vendor-notice" role="status">Profile updated.</p>}
        <div className="vendor-actions profile-settings-actions">
          <Button type="button" variant="outline" size="lg" disabled={busy} onClick={reset}>Reset Changes</Button>
          <Button type="submit" size="lg" disabled={busy}>{uploading ? "Uploading image…" : save.isPending ? "Saving…" : "Save Changes"}</Button>
        </div>
      </div>
      <div className="vendor-stack profile-settings-aside">
        <section className="vendor-card" aria-labelledby="profile-photo-heading">
          <h2 id="profile-photo-heading"><UiIcon icon={Camera} size="sm" /> Profile Photo</h2>
          <ImageUploader key={resetId} value={image ? [image] : []} onChange={(urls) => setImage(urls[0] ?? null)}
            onUploadingChange={setUploading} maxImages={1} multiple={false} replaceOnUpload disabled={save.isPending} />
          {issue("image")}
        </section>
        <section className="vendor-card" aria-labelledby="profile-preview-heading">
          <h2 id="profile-preview-heading">Profile Preview</h2>
          <div className="vendor-identity">
            <AccountAvatar name={name} image={image} large />
            <div><strong>{name || profile.name}</strong>{role === "vendor" && businessName && <p>{businessName}</p>}</div>
          </div>
        </section>
        <section className="vendor-card booking-detail" aria-labelledby="account-information-heading">
          <h2 id="account-information-heading">Account Information</h2>
          <dl>
            <dt>Account type</dt><dd>{roleLabel}</dd>
            {profile.createdAt && <><dt>Member since</dt><dd>{formatDate.format(new Date(profile.createdAt))}</dd></>}
            {plan && <><dt>Subscription plan</dt><dd>{plan}</dd></>}
          </dl>
        </section>
      </div>
    </form>
  </div>
}
