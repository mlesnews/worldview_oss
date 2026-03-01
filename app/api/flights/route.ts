import { NextRequest, NextResponse } from "next/server";
import { fetchFlights, searchFlightByCallsign } from "@/lib/api/adsb";

let cachedFlights: unknown[] = [];
let cacheTime = 0;
const CACHE_TTL = 15_000; // 15 seconds

export async function GET(request: NextRequest) {
  try {
    const callsign = request.nextUrl.searchParams.get("callsign");

    if (callsign) {
      const flight = await searchFlightByCallsign(callsign);
      return NextResponse.json(flight ? [flight] : []);
    }

    const now = Date.now();
    if (cachedFlights.length > 0 && now - cacheTime < CACHE_TTL) {
      return NextResponse.json(cachedFlights);
    }

    const flights = await fetchFlights();
    cachedFlights = flights;
    cacheTime = Date.now();
    return NextResponse.json(flights);
  } catch (error) {
    console.error("Flights API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
