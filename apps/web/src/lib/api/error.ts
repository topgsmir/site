import axios from "axios";

export type SafeApiErrorCopy = {
  fallback: string;
  network: string;
  auth: string;
  forbidden: string;
  validation: string;
  unavailable: string;
  rateLimited: string;
  conflict: string;
  notFound: string;
  reference: string;
};

function requestReference(error: unknown) {
  if (!axios.isAxiosError(error)) return null;
  const bodyReference = error.response?.data?.requestId;
  const headerReference = error.response?.headers?.["x-request-id"];
  const value = typeof bodyReference === "string"
    ? bodyReference
    : typeof headerReference === "string"
      ? headerReference
      : null;
  return value && /^[a-zA-Z0-9-]{8,80}$/.test(value) ? value : null;
}

export function safeApiError(error: unknown, copy: SafeApiErrorCopy) {
  if (!axios.isAxiosError(error)) return copy.fallback;

  const status = error.response?.status;
  let message = copy.fallback;
  if (!error.response) message = copy.network;
  else if (status === 400 || status === 422) message = copy.validation;
  else if (status === 401) message = copy.auth;
  else if (status === 403) message = copy.forbidden;
  else if (status === 404) message = copy.notFound;
  else if (status === 409) message = copy.conflict;
  else if (status === 429) message = copy.rateLimited;
  else if (status === 503 || (status !== undefined && status >= 500)) message = copy.unavailable;

  const reference = requestReference(error);
  return reference ? `${message} ${copy.reference}: ${reference}` : message;
}
