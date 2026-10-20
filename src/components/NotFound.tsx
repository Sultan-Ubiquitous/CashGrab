import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function NotFound({ children }: { children?: ReactNode }) {
  return (
    <div className="space-y-2 p-2">
      <div className="text-fg-2">{children || <p>The page you are looking for does not exist.</p>}</div>
      <p className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => window.history.back()}
          className="bg-accent text-accent-fg px-3 py-1.5 rounded-md uppercase font-black text-sm"
        >
          Go back
        </button>
        <Link to="/" className="bg-accent text-accent-fg px-3 py-1.5 rounded-md uppercase font-black text-sm">
          Start Over
        </Link>
      </p>
    </div>
  )
}
