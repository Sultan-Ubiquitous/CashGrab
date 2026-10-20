import * as React from 'react'

/** Minimal line icon set (24px grid, currentColor stroke). Decorative by default. */
function Svg({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? 'h-5 w-5 shrink-0'}
    >
      {children}
    </svg>
  )
}

type IconProps = { className?: string }

export const HomeIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </Svg>
)
export const TripsIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="18" r="2" />
    <circle cx="18" cy="6" r="2" />
    <path d="M8 18h7a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h7" />
  </Svg>
)
export const BricksIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <path d="M3 12h18M9 5v7M15 12v7" />
  </Svg>
)
export const PaymentsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 5h10M7 9h10M9 5c3.5 0 5.5 1.8 5.5 4S12.5 13 9 13h-.5L15 19" />
  </Svg>
)
export const TruckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
    <circle cx="7" cy="17.5" r="1.5" />
    <circle cx="17" cy="17.5" r="1.5" />
  </Svg>
)
export const DriverIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
    <path d="M12 14.5V21M9.5 13.2 3.5 10.5M14.5 13.2l6-2.7" />
  </Svg>
)
export const CustomersIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 4.7a3.5 3.5 0 0 1 0 6.6M18.5 14.8c1.6.8 2.6 2.7 3 5.2" />
  </Svg>
)
export const ReportsIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h16M7 16v-5M12 16V6M17 16v-8" />
  </Svg>
)
export const ProfileIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c.8-4 4-6 8-6s7.2 2 8 6" />
  </Svg>
)
export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </Svg>
)
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const ChevronUpIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 15 6-6 6 6" />
  </Svg>
)
export const ChevronDownIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 6-6 6 6 6" />
  </Svg>
)
export const ChevronRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)
export const SortIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m8 9 4-4 4 4M8 15l4 4 4-4" />
  </Svg>
)
export const ArrowLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 12H5m6-6-6 6 6 6" />
  </Svg>
)
export const ArrowRightIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </Svg>
)
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 12 5 5 9-10" />
  </Svg>
)
export const LogOutIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Svg>
)
