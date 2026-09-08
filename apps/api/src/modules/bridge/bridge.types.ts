import type { BridgeFieldDefinition, BridgeServiceKind } from "@topgsm/shared-types";

export type BridgeCredentials = {
  baseUrl: string;
  username: string;
  apiKey: string;
};

export type NormalizedBridgeService = {
  externalId: string;
  name: string;
  groupName: string | null;
  kind: BridgeServiceKind;
  fields: BridgeFieldDefinition[];
  metadata: Record<string, unknown>;
};

export type BridgeSubmitInput = {
  serviceExternalId: string;
  kind: BridgeServiceKind;
  fields: Record<string, string>;
  quantity: number;
};

export type BridgeResult = {
  status: "pending" | "success" | "failed";
  providerReference: string;
  result?: Record<string, unknown>;
  diagnosticCode?: string;
};

export interface BridgeProviderAdapter {
  testConnection(credentials: BridgeCredentials): Promise<void>;
  listServices(credentials: BridgeCredentials): Promise<NormalizedBridgeService[]>;
  submitOrder(credentials: BridgeCredentials, input: BridgeSubmitInput): Promise<BridgeResult>;
  checkOrder(
    credentials: BridgeCredentials,
    input: { providerReference: string; kind: BridgeServiceKind }
  ): Promise<BridgeResult>;
}

