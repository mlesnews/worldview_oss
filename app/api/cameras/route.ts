import { NextResponse } from "next/server";
import { getAllCameras } from "@/lib/api/cameras";

export async function GET() {
  const cameras = await getAllCameras();
  return NextResponse.json(cameras);
}
