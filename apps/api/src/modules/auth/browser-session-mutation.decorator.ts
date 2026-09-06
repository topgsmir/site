import { SetMetadata } from "@nestjs/common";

export const BROWSER_SESSION_MUTATION = "topgsm:browser-session-mutation";

export const BrowserSessionMutation = () =>
  SetMetadata(BROWSER_SESSION_MUTATION, true);
