import { NextResponse } from "next/server";
import { fetchFlights } from "@/lib/api/opensky";

export async function GET() {
  try {
    const flights = await fetchFlights();
    return NextResponse.json(flights);
  } catch (error) {
    console.error("Flights API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
