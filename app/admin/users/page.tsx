import type { Metadata } from "next"
import { ManageUsers } from "@/components/admin/manage-users"

export const metadata: Metadata = { title: "Users Management" }

export default function AdminUsersPage() {
  return <ManageUsers />
}
