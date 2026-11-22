import { LoaderCircle } from "lucide-react"
import { UiIcon } from "./icon"

export function LoadingLabel({ children }: { children: string }) {
  return <p className="wp-loading-label" role="status"><UiIcon icon={LoaderCircle} size="sm" />{children}</p>
}
