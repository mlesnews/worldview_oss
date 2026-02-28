import { NextResponse } from "next/server";
import { getCameras } from "@/lib/api/cameras";

export async function GET() {
  return NextResponse.json(getCameras());
}
