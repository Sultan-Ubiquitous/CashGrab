export type Theme = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'quickmoney-theme'

export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Applies the theme immediately and persists it. 'system' defers to the OS. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset.theme
  else root.dataset.theme = theme
  try {
    if (theme === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Private mode / storage disabled: the theme still applies for this visit.
  }
}

/** Runs before first paint (inlined in the document head) so the saved theme
 *  never flashes the wrong colors. Keep in sync with applyTheme/getStoredTheme. */
// prettier-ignore
export const THEME_BOOTSTRAP =
  `try{var t=localStorage.getItem('` + THEME_STORAGE_KEY + `');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}`
