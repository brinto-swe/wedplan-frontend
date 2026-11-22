"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef } from "react"
import { HeartHandshake, Menu } from "lucide-react"

function Wordmark() {
  return <Link href="/" className="wp-brand"><HeartHandshake size={23} strokeWidth={1.45} aria-hidden="true" /> WedPlan</Link>
}

export function PublicHeader() {
  const menu = useRef<HTMLDetailsElement>(null)
  const pathname = usePathname()
  const closeMenu = () => { if (menu.current) menu.current.open = false }
  return (
    <header className="wp-header">
      <div className="wp-wrap wp-nav">
        <Wordmark />
        <nav className="wp-desktop-nav" aria-label="Main navigation">
          <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Home</Link><Link href="/services" aria-current={pathname === "/services" ? "page" : undefined}>Browse services</Link><Link href="/#categories">Categories</Link>
        </nav>
        <div className="wp-desktop-signin wp-auth-links"><Link href="/sign-in" className="wp-button wp-button-outline">Sign in</Link><Link href="/sign-up" className="wp-button">Sign up</Link></div>
        <details className="wp-mobile-nav" ref={menu}>
          <summary aria-label="Navigation menu"><Menu size={23} aria-hidden="true" /></summary>
          <nav aria-label="Mobile navigation">
            <Link href="/" onClick={closeMenu}>Home</Link><Link href="/services" onClick={closeMenu}>Browse services</Link>
            <Link href="/#categories" onClick={closeMenu}>Categories</Link><Link href="/sign-in" onClick={closeMenu}>Sign in</Link><Link href="/sign-up" onClick={closeMenu}>Sign up</Link>
          </nav>
        </details>
      </div>
    </header>
  )
}

export function PublicFooter() {
  return (
    <footer className="wp-footer">
      <div className="wp-wrap wp-footer-main">
        <div><Wordmark /><p>A place to find the people and places behind your wedding.</p></div>
        <nav aria-label="Footer navigation"><Link href="/services">Browse services</Link><Link href="/#categories">Categories</Link><Link href="/sign-in">Sign in</Link></nav>
      </div>
      <div className="wp-wrap wp-footer-bottom">© WedPlan</div>
    </footer>
  )
}
