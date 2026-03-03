import { NextRequest, NextResponse } from "next/server";
import { VOICE_SIDECAR_URL } from "@/lib/constants";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get("audio");
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: "No audio provided" }, { status: 400 });
    }

    // Forward audio to sidecar
    const sidecarForm = new FormData();
    sidecarForm.append("audio", audio, "recording.webm");

    const res = await fetch(`${VOICE_SIDECAR_URL}/v1/voice/chat`, {
      method: "POST",
      body: sidecarForm,
      signal: AbortSignal.timeout(60_000), // 60s for model inference
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Sidecar error");
      return NextResponse.json({ error: errText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({
      text: data.text ?? "",
      audioBase64: data.audioBase64 ?? null,
      toolCalls: data.toolCalls ?? [],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Voice request failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
