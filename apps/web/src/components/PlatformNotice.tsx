"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

export function PlatformNotice() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.get<{ message: string | null }>("/notice")
      .then(({ data }) => { if (active) setMessage(data.message); })
      .catch(() => { if (active) setMessage(null); });
    return () => { active = false; };
  }, []);

  if (!message) return null;
  return <aside role="status" style={{ padding: "0.75rem 1.25rem", textAlign: "center", background: "#fff1c7", color: "#332600", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message}</aside>;
}
