import type { SVGProps } from "react";

const paths = {
  overview: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  orders: "m3 7 9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4v5",
  account: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  wallet: "M3 7h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V7Zm0 0V5a2 2 0 0 1 2-2h13v4m3 4h-6a2 2 0 0 0 0 4h6m-6-2h.01",
  arrow: "M5 12h14m-6-6 6 6-6 6",
  cart: "M3 3h2l3 12h11l2-9H6M10 20h.01M18 20h.01",
  rank: "M9 21H4V11h5m0 10V4h6v17m0-14h5v14H9",
  chevron: "m8 10 4 4 4-4",
  file: "M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 13h8M8 17h5",
  check: "m5 12 4 4L19 6",
  search: "M20 20l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
} as const;

export function AccountIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-directional={name === "arrow" || undefined} {...props}><path d={paths[name]} /></svg>;
}
