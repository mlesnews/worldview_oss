import { NextRequest, NextResponse } from "next/server";
import { AUSTIN_CAMERAS } from "@/lib/api/cameras";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing camera id" }, { status: 400 });
  }

  const camera = AUSTIN_CAMERAS.find((c) => c.id === id);
  if (!camera) {
    return NextResponse.json({ error: "Camera not found" }, { status: 404 });
  }

  try {
    const res = await fetch(camera.feedUrl, {
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Feed unavailable" },
        { status: 502 }
      );
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Feed fetch failed" },
      { status: 502 }
    );
  }
}
