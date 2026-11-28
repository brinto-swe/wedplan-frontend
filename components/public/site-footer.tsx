import Link from "next/link"
import { HeartHandshake } from "lucide-react"
import { ThemeSelect } from "@/components/ui/theme-select"
import { UiIcon } from "@/components/ui/icon"

const project = "https://github.com/brinto-swe/wedplan-frontend"

export function PublicFooter() {
  return (
    <footer className="wp-footer">
      <div className="wp-wrap wp-footer-main">
        <div>
          <Link href="/" className="wp-brand"><UiIcon icon={HeartHandshake} size="lg" /> WedPlan</Link>
          <p>Find wedding venues, services, and professionals to bring your plans to life.</p>
        </div>
        <section className="wp-footer-group" aria-label="Explore WedPlan">
          <strong>Explore WedPlan</strong>
          <nav aria-label="Footer navigation">
            <Link href="/">Home</Link><Link href="/services">Browse services</Link><Link href="/#categories">Categories</Link>
          </nav>
        </section>
        <section className="wp-footer-group" aria-label="Project contact">
          <strong>Project contact</strong>
          <a href={project + "/issues"}>Report a site issue</a>
          <a href={project}>WedPlan on GitHub</a>
        </section>
        <ThemeSelect />
      </div>
      <div className="wp-wrap wp-footer-bottom">© {new Date().getUTCFullYear()} WedPlan</div>
    </footer>
  )
}
