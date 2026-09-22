import type { GoghdiPublicConfig } from "@topgsm/shared-types";
import { api } from "@/lib/api/client";
import { isAxiosError } from "axios";

export type GoghdiTicketOptions = {
  productId: string;
  chatTitle?: string;
  category?: string;
  department?: string;
  chatInfo?: string;
  agentIds?: string[];
};

type GoghdiProof = {
  signature: string;
  timestamp: number;
  nonce: string;
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
    proof: GoghdiProof
  ): Promise<unknown>;
};

declare global {
  interface Window {
    Goghdi?: GoghdiApi;
  }
}

const SDK_ELEMENT_ID = "goghdi-browser-sdk";
let sdkPromise: Promise<GoghdiApi> | undefined;
let resolveSdk: ((api: GoghdiApi) => void) | undefined;
let configPromise: Promise<GoghdiPublicConfig> | undefined;

export function loadGoghdiConfig() {
  configPromise ??= api.get<GoghdiPublicConfig>("/goghdi/config")
    .then((response) => response.data)
    .catch((error) => {
      configPromise = undefined;
      throw error;
    });
  return configPromise;
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

export async function openGoghdiOrderTicket(orderId: string) {
  const config = await loadGoghdiConfig();
  if (!config.enabled) throw new Error("Goghdi is not configured");

  let data: unknown;
  try {
    const response = await api.post<unknown>("/goghdi/order-ticket", { orderId });
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
  return goghdi.openOrCreateTicketForProduct(data.options, data.proof);
}

function isSignedTicket(value: unknown): value is {
  options: GoghdiTicketOptions;
  proof: GoghdiProof;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { options?: unknown; proof?: unknown };
  if (!candidate.options || typeof candidate.options !== "object" || !candidate.proof || typeof candidate.proof !== "object") return false;
  const options = candidate.options as Partial<GoghdiTicketOptions>;
  const proof = candidate.proof as Partial<GoghdiProof>;
  return (
    typeof options.productId === "string" &&
    options.productId.length > 0 && options.productId.length <= 100 &&
    Array.isArray(options.agentIds) && options.agentIds.length === 1 &&
    options.agentIds.every((id) => typeof id === "string" && /^[a-f0-9]{24}$/i.test(id)) &&
    typeof proof.signature === "string" && /^[a-f0-9]{64}$/i.test(proof.signature) &&
    Number.isSafeInteger(proof.timestamp) &&
    typeof proof.nonce === "string" && /^[A-Za-z0-9_-]{16,128}$/.test(proof.nonce)
  );
}
