import { api } from "@/lib/api/client";
import { safeExternalHref, safeInternalPath } from "@/lib/safe-navigation";

export async function openDigitalDownload(downloadPath: string) {
  const path = safeInternalPath(downloadPath, "/orders/");
  if (!path || !/^\/orders\/[0-9a-f-]+\/items\/[0-9a-f-]+\/download(?:\?fileIndex=\d+)?$/i.test(path)) {
    throw new Error("Invalid digital download path");
  }
  // Opening the tab within the click handler keeps browsers from blocking it.
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const response = await api.post<{ url: string }>(path);
    const destination = safeExternalHref(response.data.url);
    if (!destination || new URL(destination).protocol !== "https:") throw new Error("Invalid digital download destination");
    if (tab) tab.location.replace(destination);
    else window.location.assign(destination);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
