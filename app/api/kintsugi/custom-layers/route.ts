import { NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import type { CustomLayer } from "@/types";

const DATA_FILE = "/home/mlesn/my_projects/worldview/data/custom-layers.json";

async function loadLayers(): Promise<CustomLayer[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveLayers(layers: CustomLayer[]): Promise<void> {
  await mkdir(dirname(DATA_FILE), { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(layers, null, 2));
}

export async function GET() {
  try {
    // Try Lumina Kintsugi bridge first
    try {
      const luminaRes = await fetch("http://localhost:8001/api/kintsugi/custom-layers", {
        signal: AbortSignal.timeout(5000),
      });
      if (luminaRes.ok) {
        const luminaData = await luminaRes.json();
        if (Array.isArray(luminaData) && luminaData.length > 0) {
          return NextResponse.json(luminaData);
        }
      }
    } catch {
      // Lumina unavailable, use local file
    }
    const layers = await loadLayers();
    return NextResponse.json(layers);
  } catch (error) {
    console.error("Custom layers read error:", error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const layers = await loadLayers();

    const newLayer: CustomLayer = {
      id: `cl-${Date.now()}`,
      name: body.name || "Unnamed",
      latitude: body.latitude || 0,
      longitude: body.longitude || 0,
      description: body.description,
      color: body.color,
      icon: body.icon,
      metadata: body.metadata,
    };

    layers.push(newLayer);
    await saveLayers(layers);
    return NextResponse.json(newLayer, { status: 201 });
  } catch (error) {
    console.error("Custom layers write error:", error);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id param" }, { status: 400 });
    }

    const layers = await loadLayers();
    const filtered = layers.filter((l) => l.id !== id);
    await saveLayers(filtered);
    return NextResponse.json({ deleted: id });
  } catch (error) {
    console.error("Custom layers delete error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
