"use client";

import { useEffect } from "react";
import { getTrafficSource } from "@/lib/traffic-source";

export function TrafficSourceCapture() {
  useEffect(() => { getTrafficSource(); }, []);
  return null;
}
