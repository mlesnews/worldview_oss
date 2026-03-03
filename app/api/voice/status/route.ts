import { NextResponse } from "next/server";
import { VOICE_SIDECAR_URL, VOICE_STATUS_TIMEOUT_MS } from "@/lib/constants";

export async function GET() {
  try {
    const res = await fetch(`${VOICE_SIDECAR_URL}/v1/voice/status`, {
      signal: AbortSignal.timeout(VOICE_STATUS_TIMEOUT_MS),
    });
    if (!res.ok) {
      return NextResponse.json({ connected: false });
    }
    const data = await res.json();
    return NextResponse.json({ connected: true, model: data.model ?? null });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
