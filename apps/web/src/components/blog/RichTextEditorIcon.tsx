const paths = {
  undo: "M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12h-3",
  redo: "m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12h3",
  bulletList: "M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01",
  orderedList: "M10 6h11M10 12h11M10 18h11M3 3h1v6M3 9h3M3 14c0-2 3-2 3 0 0 1-3 3-3 4h3",
  link: "m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m4 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0",
  table: "M3 4h18v16H3V4Zm0 5h18M3 14h18M9 4v16m6-16v16"
} as const;

export function RichTextEditorIcon({ name }: { name: keyof typeof paths }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}
