/* ============================================================
   CodeMap — icon set (ported from componentsUI/assets/components.jsx)
   Simple geometric line icons; stroke = currentColor unless solid.
   ============================================================ */
import type { CSSProperties, ReactNode } from "react";

const P: Record<string, ReactNode> = {
  logo: (
    <g>
      <circle cx="6" cy="7" r="2.4" />
      <circle cx="18" cy="6" r="2.4" />
      <circle cx="12" cy="18" r="2.4" />
      <path d="M7.8 8.4 10.6 16M16.4 7.6 13 16.2M8 7.2 16 6.4" />
    </g>
  ),
  search: (
    <g>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </g>
  ),
  bell: <path d="M18 8a6 6 0 1 0-12 0c0 7-2 9-2 9h16s-2-2-2-9M13.7 20a2 2 0 0 1-3.4 0" />,
  settings: (
    <g>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </g>
  ),
  github: (
    <path
      d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.36 1.09 2.94.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2z"
      strokeWidth="0"
    />
  ),
  caret: <path d="M6 9l6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  fit: <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />,
  browser: (
    <g>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M7 6.6h.01M9.4 6.6h.01" />
    </g>
  ),
  shield: <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3zM9.5 12l1.8 1.8L15 10" />,
  route: (
    <g>
      <circle cx="6" cy="18" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <path d="M8 18h6a3 3 0 0 0 3-3V8" />
    </g>
  ),
  cpu: (
    <g>
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M10 2.5v2.5M14 2.5v2.5M10 19v2.5M14 19v2.5M2.5 10H5M2.5 14H5M19 10h2.5M19 14h2.5" />
    </g>
  ),
  database: (
    <g>
      <ellipse cx="12" cy="6" rx="7" ry="2.6" />
      <path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6M5 12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6" />
    </g>
  ),
  layers: <path d="M12 3l8 4.2-8 4.2-8-4.2L12 3zM4 12l8 4.2 8-4.2M4 16.4l8 4.2 8-4.2" />,
  spark: <path d="M12 3l1.9 5.7L19.5 10l-5.6 1.3L12 17l-1.9-5.7L4.5 10l5.6-1.3L12 3z" />,
  file: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5" />,
  folder: <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />,
  table: (
    <g>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M4 10h16M4 14.5h16M9.5 10v9M14.5 10v9" />
    </g>
  ),
  bucket: <path d="M5 7h14l-1.2 12.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8L5 7zM4 7l1-3h14l1 3" />,
  play: <path d="M7 5l12 7-12 7V5z" strokeWidth="0" />,
  pause: (
    <g strokeWidth="0">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </g>
  ),
  mic: (
    <g>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </g>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  replay: <path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v3.5h3.5" />,
  skip: <path d="M5 5l9 7-9 7V5zM18 5v14" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01" />,
  info: (
    <g>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </g>
  ),
  code: <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  link: <path d="M9.5 14.5l5-5M8 11l-2 2a3.5 3.5 0 0 0 5 5l2-2M16 13l2-2a3.5 3.5 0 0 0-5-5l-2 2" />,
  wave: <path d="M3 12h2l2-6 3 14 3-11 2 6 2-3h2" />,
  message: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z" />,
  quote: <path d="M9 8H5a2 2 0 0 0-2 2v3h4v-3M19 8h-4a2 2 0 0 0-2 2v3h4v-3" />,
  sitemap: (
    <g>
      <rect x="9" y="3" width="6" height="5" rx="1" />
      <rect x="3" y="16" width="6" height="5" rx="1" />
      <rect x="15" y="16" width="6" height="5" rx="1" />
      <path d="M12 8v4M6 16v-2a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2" />
    </g>
  ),
};

export type IconKey = keyof typeof P;

export function Icon({
  n,
  className,
  style,
}: {
  n: string;
  className?: string;
  style?: CSSProperties;
}) {
  const solid = n === "github" || n === "play" || n === "pause";
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill={solid ? "currentColor" : "none"}
      stroke={solid ? "none" : "currentColor"}
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {P[n] ?? null}
    </svg>
  );
}

export default Icon;
