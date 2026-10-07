"use client";

import Image from "next/image";
import { useState } from "react";

export function UserAvatar({ name, url, className, size = 52 }: {
  name: string;
  url?: string | null;
  className?: string;
  size?: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("");
  return <span className={className} aria-hidden="true">
    {url && failedUrl !== url
      ? <Image src={url} alt="" width={size} height={size} unoptimized onError={() => setFailedUrl(url)} />
      : initials}
  </span>;
}
