import type { RichTextDocument, RichTextNode } from "@topgsm/shared-types";
import Image from "next/image";
import type { ReactNode } from "react";

const SAFE_LINK = /^(https?:|mailto:|tel:)/i;
const SAFE_IMAGE = /^\/media\/[0-9a-f-]{36}\/[a-z0-9-]+\.webp$/i;

export function RichText({ document }: { document: RichTextDocument }) {
  return <div className="article-prose">{renderNodes(document.content ?? [])}</div>;
}

function renderNodes(nodes: RichTextNode[]): ReactNode {
  return nodes.map((node, index) => renderNode(node, index));
}

function renderNode(node: RichTextNode, key: number): ReactNode {
  const children = renderNodes(node.content ?? []);
  let result: ReactNode;
  switch (node.type) {
    case "paragraph": result = <p key={key}>{children}</p>; break;
    case "heading": {
      const level = node.attrs?.level === 3 ? 3 : 2;
      result = level === 3 ? <h3 key={key}>{children}</h3> : <h2 key={key}>{children}</h2>;
      break;
    }
    case "bulletList": result = <ul key={key}>{children}</ul>; break;
    case "orderedList": result = <ol key={key}>{children}</ol>; break;
    case "listItem": result = <li key={key}>{children}</li>; break;
    case "blockquote": result = <blockquote key={key}>{children}</blockquote>; break;
    case "codeBlock": result = <pre key={key}><code>{children}</code></pre>; break;
    case "hardBreak": result = <br key={key} />; break;
    case "image": {
      const src = typeof node.attrs?.src === "string" && SAFE_IMAGE.test(node.attrs.src)
        ? node.attrs.src
        : null;
      result = src ? <Image key={key} unoptimized src={src} alt="" width={960} height={640} sizes="(max-width: 760px) 100vw, 760px" /> : null;
      break;
    }
    case "text": result = node.text ?? ""; break;
    default: result = children;
  }
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") result = <strong key={`${key}-bold`}>{result}</strong>;
    else if (mark.type === "italic") result = <em key={`${key}-italic`}>{result}</em>;
    else if (mark.type === "strike") result = <s key={`${key}-strike`}>{result}</s>;
    else if (mark.type === "code") result = <code key={`${key}-code`}>{result}</code>;
    else if (mark.type === "link") {
      const href = typeof mark.attrs?.href === "string" && SAFE_LINK.test(mark.attrs.href)
        ? mark.attrs.href
        : undefined;
      if (href) result = <a key={`${key}-link`} href={href} rel="nofollow noopener">{result}</a>;
    }
  }
  return result;
}
