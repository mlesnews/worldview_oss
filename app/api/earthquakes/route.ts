import { NextResponse } from "next/server";
import { fetchEarthquakes } from "@/lib/api/usgs";

export async function GET() {
  try {
    const earthquakes = await fetchEarthquakes("day", "2.5");
    return NextResponse.json(earthquakes);
  } catch (error) {
    console.error("Earthquakes API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
