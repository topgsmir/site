import type { SVGProps } from "react";
const paths = {
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  wrench: "M14 6a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l5-5a5 5 0 0 0 6-6l-4 4-4-4 4-4Z",
  bag: "M4 7h16l1 14H3L4 7Zm4 0V5a4 4 0 0 1 8 0v2m-8 3a4 4 0 0 0 8 0",
  crown: "m3 6 4 4 5-7 5 7 4-4-2 12H5L3 6Zm2 15h14",
  trophy: "M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4m-5 3v6m-4 0h8",
  star: "m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z",
  warning: "m12 3 10 18H2L12 3Zm0 6v5m0 3h.01",
  plus: "M12 5v14M5 12h14",
  learning: "m2 8 10-5 10 5-10 5L2 8Zm4 2v7l6 4 6-4v-7m4-2v9",
} as const;
export function DashboardIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: keyof typeof paths }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
