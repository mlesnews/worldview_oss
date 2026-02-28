import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q || q.trim().length < 2) {
    return NextResponse.json([]);
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "WorldView/1.0",
      },
    });

    if (!res.ok) {
      return NextResponse.json([], { status: 502 });
    }

    const data = await res.json();

    const results = data.map(
      (item: { display_name: string; lat: string; lon: string }) => ({
        name: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      })
    );

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
