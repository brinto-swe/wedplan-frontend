import type { Metadata } from "next"
import { AuthScreen, type AuthQuery } from "@/components/auth/auth-screen"

export const metadata: Metadata = { title: "Sign in" }

export default async function SignInPage({ searchParams }: { searchParams: Promise<AuthQuery> }) {
  return <AuthScreen mode="sign-in" query={await searchParams} />
}
