import type { Camera } from "@/types";

/**
 * Austin, TX traffic camera feeds from City of Austin Mobility.
 * Public CCTV snapshot endpoint: https://cctv.austinmobility.io/image/{id}.jpg
 * Data source: https://data.austintexas.gov/resource/b4k4-adkb.json
 */
export const AUSTIN_CAMERAS: Camera[] = [
  {
    id: "458",
    name: "Koenig Ln / Guadalupe St",
    latitude: 30.3235,
    longitude: -97.7238,
    feedUrl: "https://cctv.austinmobility.io/image/458.jpg",
    city: "Austin",
    active: true,
  },
  {
    id: "463",
    name: "Mopac / Northland Dr",
    latitude: 30.3355,
    longitude: -97.7537,
    feedUrl: "https://cctv.austinmobility.io/image/463.jpg",
    city: "Austin",
    active: true,
  },
  {
    id: "466",
    name: "Burnet Rd / 49th St",
    latitude: 30.3199,
    longitude: -97.7392,
    feedUrl: "https://cctv.austinmobility.io/image/466.jpg",
    city: "Austin",
    active: true,
  },
  {
    id: "468",
    name: "Burnet Rd / Steck Ave",
    latitude: 30.3618,
    longitude: -97.7293,
    feedUrl: "https://cctv.austinmobility.io/image/468.jpg",
    city: "Austin",
    active: true,
  },
  {
    id: "470",
    name: "Burnet Rd / Kramer Ln",
    latitude: 30.3952,
    longitude: -97.7204,
    feedUrl: "https://cctv.austinmobility.io/image/470.jpg",
    city: "Austin",
    active: true,
  },
  {
    id: "473",
    name: "Metric Blvd / Rundberg Ln",
    latitude: 30.3752,
    longitude: -97.7197,
    feedUrl: "https://cctv.austinmobility.io/image/473.jpg",
    city: "Austin",
    active: true,
  },
  {
    id: "474",
    name: "Rundberg Ln / Parkfield Dr",
    latitude: 30.3674,
    longitude: -97.7062,
    feedUrl: "https://cctv.austinmobility.io/image/474.jpg",
    city: "Austin",
    active: true,
  },
  {
    id: "471",
    name: "Burnet Rd / Gault Ln",
    latitude: 30.4049,
    longitude: -97.7160,
    feedUrl: "https://cctv.austinmobility.io/image/471.jpg",
    city: "Austin",
    active: true,
  },
];

export function getCameras(): Camera[] {
  return AUSTIN_CAMERAS;
}
