import { api } from "@/lib/api/client";
import { isAxiosError } from "axios";

export type GoghdiTicketOptions = {
  productId: string | number;
  chatTitle?: string;
  category?: string;
  department?: string;
  chatInfo?: string;
};

type GoghdiApi = {
  version: string;
  init(config: {
    tenantId: string;
    apiUrl: string;
    socketUrl?: string;
    widgetUrl: string;
    position: "bottom-right" | "bottom-left" | "inline";
    container?: string;
  }): void;
  show(): void;
  hide(): void;
  destroy(): void;
  openOrCreateTicketForProduct(
    options: GoghdiTicketOptions,
    hmackSignature: string
  ): void;
};

declare global {
  interface Window {
    Goghdi?: GoghdiApi;
  }
}

const SDK_ELEMENT_ID = "goghdi-browser-sdk";
let sdkPromise: Promise<GoghdiApi> | undefined;
let resolveSdk: ((api: GoghdiApi) => void) | undefined;

export const goghdiEnabled = Boolean(
  process.env.NEXT_PUBLIC_GOGHDI_SDK_URL &&
  process.env.NEXT_PUBLIC_GOGHDI_TENANT_ID &&
  process.env.NEXT_PUBLIC_GOGHDI_API_URL &&
  process.env.NEXT_PUBLIC_GOGHDI_WIDGET_URL
);

export function getGoghdiConfig() {
  if (!goghdiEnabled) return null;
  return {
    sdkUrl: process.env.NEXT_PUBLIC_GOGHDI_SDK_URL!,
    tenantId: process.env.NEXT_PUBLIC_GOGHDI_TENANT_ID!,
    apiUrl: process.env.NEXT_PUBLIC_GOGHDI_API_URL!,
    socketUrl: process.env.NEXT_PUBLIC_GOGHDI_SOCKET_URL,
    widgetUrl: process.env.NEXT_PUBLIC_GOGHDI_WIDGET_URL!
  };
}

export function waitForGoghdiSdk() {
  if (window.Goghdi) return Promise.resolve(window.Goghdi);
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<GoghdiApi>((resolve, reject) => {
    resolveSdk = resolve;
    window.setTimeout(() => reject(new Error("Timed out waiting for the Goghdi SDK")), 15_000);
  }).catch((error) => {
    sdkPromise = undefined;
    resolveSdk = undefined;
    throw error;
  });
  return sdkPromise;
}

export function markGoghdiSdkReady() {
  if (!window.Goghdi) throw new Error("Goghdi SDK loaded without exposing window.Goghdi");
  resolveSdk?.(window.Goghdi);
  return window.Goghdi;
}

export { SDK_ELEMENT_ID };

export class GoghdiAuthenticationRequiredError extends Error {}

export async function openGoghdiProductTicket(productId: string) {
  const config = getGoghdiConfig();
  if (!config) throw new Error("Goghdi is not configured");

  let data: unknown;
  try {
    const response = await api.post<unknown>("/goghdi/product-ticket", { productId });
    data = response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 401) {
      throw new GoghdiAuthenticationRequiredError("Sign in is required");
    }
    throw error;
  }
  if (!isSignedTicket(data)) throw new Error("Invalid Goghdi signing response");

  const goghdi = await waitForGoghdiSdk();
  goghdi.show();
  goghdi.openOrCreateTicketForProduct(
    data.options,
    data.signature
  );
}

function isSignedTicket(value: unknown): value is {
  options: GoghdiTicketOptions;
  signature: string;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { options?: unknown; signature?: unknown };
  if (!candidate.options || typeof candidate.options !== "object") return false;
  const options = candidate.options as Partial<GoghdiTicketOptions>;
  return (
    (typeof options.productId === "string" || typeof options.productId === "number") &&
    typeof candidate.signature === "string" &&
    /^[a-f0-9]{64}$/.test(candidate.signature)
  );
}
