"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import {
  loadGoghdiConfig,
  markGoghdiSdkReady,
  SDK_ELEMENT_ID
} from "@/lib/goghdi/goghdi";

export function GoghdiWidget() {
  const pathname = usePathname();
  const isPanelRoute = /^\/[^/]+\/(?:admin|seller-dashboard)(?:\/|$)/.test(pathname);
  const initialized = useRef(false);
  const [config, setConfig] = useState<Awaited<ReturnType<typeof loadGoghdiConfig>> | null>(null);

  useEffect(() => {
    if (isPanelRoute) {
      if (initialized.current) {
        window.Goghdi?.destroy();
        initialized.current = false;
      }
      return;
    }

    let active = true;
    void loadGoghdiConfig()
      .then((value) => { if (active) setConfig(value); })
      .catch((error) => console.error("Unable to load Goghdi configuration", error));
    return () => { active = false; };
  }, [isPanelRoute]);

  useEffect(() => {
    return () => {
      if (initialized.current) {
        window.Goghdi?.destroy();
        initialized.current = false;
      }
    };
  }, []);

  if (isPanelRoute || !config?.enabled || !config.sdkUrl || !config.tenantId || !config.apiUrl || !config.widgetUrl) return null;
  const activeConfig = {
    sdkUrl: config.sdkUrl,
    tenantId: config.tenantId,
    apiUrl: config.apiUrl,
    socketUrl: config.socketUrl,
    widgetUrl: config.widgetUrl
  };

  return (
    <Script
      id={SDK_ELEMENT_ID}
      type="module"
      src={activeConfig.sdkUrl}
      strategy="lazyOnload"
      onReady={() => {
        if (initialized.current) return;
        try {
          const goghdi = markGoghdiSdkReady();
          goghdi.init({
            tenantId: activeConfig.tenantId,
            apiUrl: activeConfig.apiUrl,
            ...(activeConfig.socketUrl ? { socketUrl: activeConfig.socketUrl } : {}),
            widgetUrl: activeConfig.widgetUrl,
            position: "bottom-right"
          });
          initialized.current = true;
        } catch (error) {
          console.error("Unable to initialize Goghdi chat", error);
        }
      }}
      onError={(error) => console.error("Unable to load Goghdi chat", error)}
    />
  );
}
