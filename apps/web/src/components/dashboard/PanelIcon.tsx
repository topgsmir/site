import type { ReactNode } from "react";

const paths = {
  store: <><path d="M4 10v10h16V10M3 10l2-6h14l2 6M3 10c0 4 6 4 6 0 0 4 6 4 6 0 0 4 6 4 6 0M9 20v-6h6v6" /></>,
  chart: <><path d="M4 20V10m5 10V5m6 15v-7m5 7V3" /><path d="M2 22h20" /></>,
  spark: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3ZM20 2v4m-2-2h4" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  wallet: <><path d="M20 8V5H6a3 3 0 0 0 0 6h15v9H6a3 3 0 0 1-3-3V8" /><path d="M21 13h-5v4h5m-3-2h.01" /></>,
  activity: <><path d="M3 12h4l3-8 4 16 3-8h4" /><path d="M4 5v2m16 10v2" /></>,
  trophy: <><path d="M8 3h8v7a4 4 0 0 1-8 0V3Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v6m-5 1h10" /></>,
  bell: <><path d="M5 16h14l-2-3V9A5 5 0 0 0 7 9v4l-2 3Zm5 4h4M12 2v2" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  message: <><path d="M4 4h16v13H9l-5 4V4Zm4 5h8m-8 4h5" /></>,
  box: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm0 10 9-5m-9 5L3 8m9 5v9M7 6l9 5" /></>,
} satisfies Record<string, ReactNode>;

export function PanelIcon({ name }: { name: keyof typeof paths }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
