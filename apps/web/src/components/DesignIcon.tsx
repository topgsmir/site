import type { SVGProps } from "react";

export type DesignIconName = "arrow" | "file" | "layers" | "headphones" | "check" | "spark" | "search";
const paths: Record<DesignIconName, string> = {
  arrow: "M5 12h14m-6-6 6 6-6 6",
  file: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6Zm0 0v6h6M8 13h8M8 17h5",
  layers: "m12 3 10 5-10 5L2 8l10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5",
  headphones: "M4 14v-3a8 8 0 0 1 16 0v3M4 12H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h3v-6H4Zm16 0h1a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-3v-6h2Zm0 6v1a2 2 0 0 1-2 2h-5",
  check: "m5 12 4 4L19 6",
  spark: "m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z",
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"
};
export function DesignIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: DesignIconName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
