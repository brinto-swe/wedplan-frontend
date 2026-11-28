"use client"

import { serviceSortLabels, type ServiceSort } from "@/lib/services"

export function ServiceSortControl({ sort, form }: { sort: ServiceSort; form: string }) {
  return <label className="wp-browse-sort">Sort by
    <select name="sort" form={form} defaultValue={sort} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
      {Object.entries(serviceSortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>
}
