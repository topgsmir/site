"use client";

import Image from "next/image";
import { useState } from "react";
import type { SellerProfilePicture } from "@topgsm/shared-types";

export function sellerAvatarLetters(name: string, locale: string) {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  const letters = parts.length > 1
    ? parts.slice(0, 2).map((part) => Array.from(part)[0])
    : Array.from(parts[0] ?? "").slice(0, 2);
  return letters.join("").toLocaleUpperCase(locale);
}

export function SellerAvatar({ name, picture, locale, className, size = 48, priority = false }: {
  name: string;
  picture?: SellerProfilePicture | null;
  locale: string;
  className?: string;
  size?: number;
  priority?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return <span className={className} aria-hidden="true">
    {picture?.url && failedUrl !== picture.url
      ? <Image src={picture.url} alt="" width={size} height={size} priority={priority} onError={() => setFailedUrl(picture.url)} />
      : sellerAvatarLetters(name, locale)}
  </span>;
}
