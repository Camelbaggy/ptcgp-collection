/** Jeu d'icônes unique (traits arrondis, 24×24) — remplace les emojis et symboles unicode. */
const PATHS = {
  home: <path d="M3 11l9-8 9 8M5 9.5V20h5v-5h4v5h5V9.5" />,
  plus: <path d="M12 5v14M5 12h14" />,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8c-2.5 0-4-1-4-2.5S9.5 3 12 8zM12 8c2.5 0 4-1 4-2.5S14.5 3 12 8z" /></>,
  swap: <path d="M4 8h15m-4-4l4 4-4 4M20 16H5m4-4l-4 4 4 4" />,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  cal: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  trophy: <path d="M7 4h10v5a5 5 0 01-10 0V4zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3M12 14v4M8 20h8" />,
  book: <path d="M4 5.5A1.5 1.5 0 015.5 4H11v16H5.5A1.5 1.5 0 014 18.5v-13zM20 5.5A1.5 1.5 0 0018.5 4H13v16h5.5a1.5 1.5 0 001.5-1.5v-13z" />,
  heart: <path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0112 7.8 4.2 4.2 0 0119.5 10c0 5.4-7.5 10-7.5 10z" />,
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>,
  pack: <path d="M12 3l8 4v10l-8 4-8-4V7l8-4zM4 7l8 4 8-4M12 11v10" />,
  more: <><circle cx="5.5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18.5" cy="12" r="1.2" /></>,
  chev: <path d="M9 6l6 6-6 6" />,
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.7l5.9-.8L12 3.5z" />,
  cloud: <path d="M7 18a4.5 4.5 0 01-.6-8.96A6 6 0 0118 10.5 3.75 3.75 0 0117.25 18H7z" />,
  cloudoff: <path d="M3 3l18 18M7 18a4.5 4.5 0 01-.6-8.96M10 6.3A6 6 0 0118 10.5 3.75 3.75 0 0117.25 18H10" />,
  sync: <path d="M20 12a8 8 0 01-14 5.3M4 12a8 8 0 0114-5.3M18 3v4h-4M6 21v-4h4" />,
  alert: <path d="M12 4l9 16H3L12 4zM12 10v4M12 17v.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className }: { name: IconName; className?: string }) {
  return <svg className={'ic' + (className ? ' ' + className : '')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{PATHS[name]}</svg>
}
