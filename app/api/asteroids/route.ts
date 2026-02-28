import { NextResponse } from "next/server";
import { fetchAsteroids } from "@/lib/api/nasa";

export async function GET() {
  try {
    const apiKey = process.env.NASA_API_KEY || "DEMO_KEY";
    const asteroids = await fetchAsteroids(apiKey);
    return NextResponse.json(asteroids);
  } catch (error) {
    console.error("Asteroids API error:", error);
    return NextResponse.json([], { status: 500 });
  }
}
