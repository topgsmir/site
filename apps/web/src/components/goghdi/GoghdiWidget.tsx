"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";
import {
  getGoghdiConfig,
  markGoghdiSdkReady,
  SDK_ELEMENT_ID
} from "@/lib/goghdi/goghdi";

export function GoghdiWidget() {
  const initialized = useRef(false);
  const config = getGoghdiConfig();

  useEffect(() => {
    return () => {
      if (initialized.current) {
        window.Goghdi?.destroy();
        initialized.current = false;
      }
    };
  }, []);

  if (!config) return null;

  return (
    <Script
      id={SDK_ELEMENT_ID}
      type="module"
      src={config.sdkUrl}
      strategy="lazyOnload"
      onReady={() => {
        if (initialized.current) return;
        try {
          const goghdi = markGoghdiSdkReady();
          goghdi.init({
            tenantId: config.tenantId,
            apiUrl: config.apiUrl,
            ...(config.socketUrl ? { socketUrl: config.socketUrl } : {}),
            widgetUrl: config.widgetUrl,
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
