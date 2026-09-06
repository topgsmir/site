export const SESSION_COOKIE = "topgsm_session";

export function hasSessionCookie(cookieHeader: string | undefined) {
  return cookieHeader
    ?.split(";")
    .some((cookie) => cookie.trim().startsWith(`${SESSION_COOKIE}=`)) ?? false;
}

export function readSessionToken(
  cookieHeader: string | undefined,
  authorization: string | undefined
) {
  const bearer = authorization?.match(/^Bearer\s+([^\s]+)$/i)?.[1];
  if (bearer) return bearer;

  return cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim().split("="))
    .find(([name]) => name === SESSION_COOKIE)
    ?.slice(1)
    .join("=");
}
