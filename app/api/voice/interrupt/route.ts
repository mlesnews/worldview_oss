import { NextResponse } from "next/server";
import { VOICE_SIDECAR_URL, VOICE_STATUS_TIMEOUT_MS } from "@/lib/constants";

export async function POST() {
  try {
    const res = await fetch(`${VOICE_SIDECAR_URL}/v1/voice/interrupt`, {
      method: "POST",
      signal: AbortSignal.timeout(VOICE_STATUS_TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false }, { status: res.status });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
