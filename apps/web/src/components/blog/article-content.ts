import type { RichTextNode } from "@topgsm/shared-types";

export function articleText(nodes: RichTextNode[]): string {
  return nodes.map((node) => node.text ?? articleText(node.content ?? [])).join(" ");
}

export function articleHeadings(nodes: RichTextNode[], path = ""): Array<{ id: string; title: string; level: number }> {
  return nodes.flatMap((node, index) => {
    const key = `${path}${index}`;
    const children = articleHeadings(node.content ?? [], `${key}-`);
    return node.type === "heading"
      ? [{ id: `section-${key}`, title: articleText(node.content ?? []), level: node.attrs?.level === 3 ? 3 : 2 }, ...children]
      : children;
  });
}
