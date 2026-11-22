import type { Metadata } from "next"
import { AuthScreen, type AuthQuery } from "@/components/auth/auth-screen"

export const metadata: Metadata = { title: "Create an account" }

export default async function SignUpPage({ searchParams }: { searchParams: Promise<AuthQuery> }) {
  return <AuthScreen mode="sign-up" query={await searchParams} />
}
