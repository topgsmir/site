import { createRoot } from "react-dom/client";
import { BridgeCheckout, type StoreProduct } from "../../apps/web/src/components/bridge/BridgeCheckout";
import "../../apps/web/tokens.css";

const product: StoreProduct = {
  id: "product-a", slug: "service-a", title: "Device service", description: null, category: null, type: "bridge",
  bridge: { fields: [{ key: "imei", label: "IMEI", type: "text", required: true }], minimumQuantity: 1, maximumQuantity: 5 },
  variants: [
    { id: "variant-a", name: "Standard", offers: [{ id: "offer-a", price: "1000", currency: "TOMAN", seller: { shopName: "Repair shop" } }] },
    { id: "variant-b", name: "Extended", offers: [{ id: "offer-b", price: "1200", currency: "TOMAN", seller: { shopName: "Device shop" } }] },
  ],
};

createRoot(document.getElementById("root")!).render(<BridgeCheckout locale="en" product={product} signedInBuyer />);
