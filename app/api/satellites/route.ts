import { NextResponse } from "next/server";
import { fetchSatellites } from "@/lib/api/celestrak";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const group = (searchParams.get("group") || "stations") as
      | "stations"
      | "active"
      | "starlink";
    const satellites = await fetchSatellites(group);
    return NextResponse.json(satellites);
  } catch (error) {
    console.error("Satellites API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
