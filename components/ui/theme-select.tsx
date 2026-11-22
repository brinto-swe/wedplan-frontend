"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"

import { UiIcon } from "./icon"

const subscribe = () => () => {}

export function ThemeSelect() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const { theme, setTheme } = useTheme()
  const preference = mounted ? theme ?? "light" : "light"
  const Icon = preference === "dark" ? Moon : preference === "system" ? Monitor : Sun

  return (
    <label className="wp-theme-select">
      <UiIcon icon={Icon} size="sm" />
      <span className="sr-only">Color theme</span>
      <select value={preference} disabled={!mounted} onChange={(event) => setTheme(event.target.value)}>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  )
}
