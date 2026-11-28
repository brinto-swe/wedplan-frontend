import { safeReturn } from "@/lib/auth-navigation"
import Image from "next/image"
import Link from "next/link"
import { AuthForm, type AuthMode } from "./auth-form"

export type AuthQuery = Record<string, string | string[] | undefined>

export function AuthScreen({ mode, query }: { mode: AuthMode; query: AuthQuery }) {
  const destination = safeReturn(query.next)
  const signup = mode === "sign-up"

  return (
    <section className="wp-wrap account-screen" aria-labelledby="account-heading">
      <div className="account-panel">
        <div className="account-inner">
          <h1 id="account-heading">{signup ? "Create your account" : "Sign In to WedPlan"}</h1>
          <p className="account-intro">{signup
            ? "Find the right people for your wedding or share your services with couples."
            : "Sign in to your WedPlan account."}</p>
          <AuthForm mode={mode} destination={destination} oauthReturn={query.oauth === "return"} oauthError={query.oauth === "failed" || typeof query.error === "string"} />
          <p className="account-switch">
            {signup ? "Already have an account?" : "New to WedPlan?"}{" "}
            <Link href={{ pathname: signup ? "/sign-in" : "/sign-up", query: destination ? { next: destination } : {} }} className="wp-text-link">{signup ? "Sign in" : "Create an account"}</Link>
          </p>
        </div>
      </div>
      <div className="account-photo">
        <Image
          src={signup ? "/weddings/hero.webp" : "/weddings/photography.webp"}
          alt={signup ? "An elegant outdoor wedding reception at a stone villa" : "A newly married couple on a stone staircase"}
          fill sizes="(max-width: 520px) 100vw, (max-width: 900px) 90vw, 48vw"
          preload
        />
        <div className="account-photo-caption"><h2>{signup ? "Join WedPlan" : "Welcome Back"}</h2><p>{signup ? "Start planning your dream wedding." : "Find the people and places behind your wedding."}</p></div>
      </div>
    </section>
  )
}
