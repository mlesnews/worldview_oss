import type { VoiceToolCall, LayerKey, ViewMode } from "@/types";

const TOOL_REGEX = /<<TOOL:(\w+)\|([^>]+)>>/g;

const VALID_LAYERS: LayerKey[] = [
  "flights", "satellites", "disasters", "asteroids",
  "weather", "cameras", "livestreams", "news", "militaryActions",
];

const VALID_VIEW_MODES: ViewMode[] = ["eo", "flir", "nightvision", "crt"];

/** Parse <<TOOL:name|param=value,param2=value2>> markers from text */
export function parseToolCalls(text: string): VoiceToolCall[] {
  const calls: VoiceToolCall[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(TOOL_REGEX.source, TOOL_REGEX.flags);
  while ((match = re.exec(text)) !== null) {
    const tool = match[1];
    const paramStr = match[2];
    const params: Record<string, string> = {};
    for (const pair of paramStr.split(",")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx > 0) {
        params[pair.slice(0, eqIdx).trim()] = pair.slice(eqIdx + 1).trim();
      }
    }
    calls.push({ tool, params });
  }
  return calls;
}

/** Remove tool markers from display text */
export function stripToolMarkers(text: string): string {
  return text.replace(TOOL_REGEX, "").replace(/\s{2,}/g, " ").trim();
}

/** Geocode a location name via the existing /api/geocode endpoint */
async function geocode(location: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(location)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      return { lat: data[0].lat, lon: data[0].lon };
    }
  } catch { /* geocode failed */ }
  return null;
}

interface StoreActions {
  flyTo: (lon: number, lat: number, alt?: number) => void;
  toggleLayer: (layer: LayerKey) => void;
  setViewMode: (mode: ViewMode) => void;
  setDeploymentArea: (area: { lat: number; lon: number; radiusKm: number } | null) => void;
  openMissionModal: () => void;
}

/** Execute a single tool call against the store */
export async function executeTool(
  call: VoiceToolCall,
  actions: StoreActions,
): Promise<void> {
  switch (call.tool) {
    case "flyTo": {
      const location = call.params.location;
      if (!location) break;
      const coords = await geocode(location);
      if (coords) {
        const alt = call.params.altitude ? parseInt(call.params.altitude, 10) : 1_000_000;
        actions.flyTo(coords.lon, coords.lat, alt);
      }
      break;
    }

    case "deployAgents": {
      const location = call.params.location;
      if (!location) break;
      const coords = await geocode(location);
      if (coords) {
        const radius = call.params.radius ? parseInt(call.params.radius, 10) : 200;
        actions.setDeploymentArea({ lat: coords.lat, lon: coords.lon, radiusKm: radius });
        actions.openMissionModal();
        actions.flyTo(coords.lon, coords.lat, radius * 5000);
      }
      break;
    }

    case "specialistChat": {
      const message = call.params.message;
      if (!message) break;
      try {
        await fetch("/api/agents/mission/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
      } catch { /* specialist chat failed */ }
      break;
    }

    case "toggleLayer": {
      const layer = call.params.layer as LayerKey;
      if (VALID_LAYERS.includes(layer)) {
        actions.toggleLayer(layer);
      }
      break;
    }

    case "setViewMode": {
      const mode = call.params.mode as ViewMode;
      if (VALID_VIEW_MODES.includes(mode)) {
        actions.setViewMode(mode);
      }
      break;
    }
  }
}
