import { NextResponse } from "next/server";
import type { AuthLoginMethods } from "@topgsm/shared-types";
import { SERVER_API_BASE } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${SERVER_API_BASE}/auth/login-methods`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return NextResponse.json({ message: "Sign in methods are unavailable" }, { status: 503 });
    }

    const methods: unknown = await response.json();
    if (
      !methods ||
      typeof methods !== "object" ||
      !("emailPasswordEnabled" in methods) ||
      !("phoneOtpEnabled" in methods) ||
      typeof methods.emailPasswordEnabled !== "boolean" ||
      typeof methods.phoneOtpEnabled !== "boolean"
    ) {
      return NextResponse.json({ message: "Sign in methods are unavailable" }, { status: 503 });
    }

    const result: AuthLoginMethods = {
      emailPasswordEnabled: methods.emailPasswordEnabled as boolean,
      phoneOtpEnabled: methods.phoneOtpEnabled as boolean
    };
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch {
    return NextResponse.json({ message: "Sign in methods are unavailable" }, { status: 503 });
  }
}
