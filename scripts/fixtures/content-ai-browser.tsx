import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BlogEditor } from "../../apps/web/src/components/blog/BlogEditor";
import { ProductAiPanel } from "../../apps/web/src/components/ai/ProductAiPanel";

function ProductHarness() {
  const [value, setValue] = useState({ title: "Original product", description: "A repair tool for the supplied phone model. No charger included.", category: "Tools" });
  return <main><ProductAiPanel locale="en" value={value} onChange={setValue} /><label>Product title<input value={value.title} onChange={(event) => setValue({ ...value, title: event.target.value })} /></label><pre data-testid="product-draft">{JSON.stringify(value)}</pre></main>;
}

createRoot(document.getElementById("root")!).render(location.pathname === "/product" ? <ProductHarness /> : <BlogEditor postId="test-post" backHref="/" />);
