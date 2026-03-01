import type { NewsArticle } from "@/types";

const REDDIT_URL =
  "https://www.reddit.com/r/worldnews+geopolitics+BreakingNews+OSINT+middleeast/new.json?limit=50";

// ---------------------------------------------------------------------------
// Location keyword matching
// Each keyword maps to [latitude, longitude]
// ---------------------------------------------------------------------------
const LOCATION_KEYWORDS: Record<string, [number, number]> = {
  // Countries
  ukraine: [48.4, 32.0],
  russia: [58.0, 80.0],
  china: [35.0, 105.0],
  taiwan: [23.7, 120.9],
  israel: [31.5, 34.8],
  palestine: [31.9, 35.2],
  gaza: [31.5, 34.47],
  iran: [32.4, 53.7],
  iraq: [33.2, 43.7],
  syria: [35.0, 38.0],
  yemen: [15.5, 48.0],
  lebanon: [33.9, 35.8],
  afghanistan: [33.9, 67.7],
  pakistan: [30.4, 69.3],
  india: [22.0, 79.0],
  "north korea": [40.0, 127.0],
  "south korea": [36.5, 127.8],
  japan: [36.2, 138.3],
  turkey: [39.0, 35.2],
  egypt: [27.0, 30.8],
  libya: [27.0, 17.0],
  sudan: [15.5, 32.5],
  somalia: [5.2, 46.2],
  ethiopia: [9.1, 40.5],
  nigeria: [9.1, 8.7],
  "south africa": [30.6, 25.0],
  kenya: [0.02, 37.9],
  congo: [-1.0, 15.0],
  myanmar: [19.8, 96.0],
  thailand: [15.9, 100.9],
  philippines: [12.9, 121.8],
  indonesia: [-2.0, 118.0],
  mexico: [23.6, -102.6],
  brazil: [-14.2, -51.9],
  colombia: [4.6, -74.3],
  venezuela: [7.0, -66.0],
  argentina: [-35.0, -64.0],
  canada: [55.0, -97.0],
  germany: [51.2, 10.4],
  france: [46.2, 2.2],
  "united kingdom": [54.0, -2.0],
  uk: [54.0, -2.0],
  britain: [54.0, -2.0],
  poland: [51.9, 19.1],
  italy: [42.5, 12.6],
  spain: [40.5, -3.7],
  greece: [39.1, 22.0],
  australia: [-27.0, 134.0],
  "new zealand": [-41.0, 174.0],
  saudi: [24.0, 44.0],
  "saudi arabia": [24.0, 44.0],
  uae: [24.0, 54.0],
  qatar: [25.3, 51.2],
  "hong kong": [22.3, 114.2],
  singapore: [1.35, 103.8],
  malaysia: [4.2, 101.9],
  vietnam: [16.0, 106.0],
  nepal: [28.4, 84.1],
  "sri lanka": [7.9, 80.8],
  bangladesh: [23.7, 90.4],
  morocco: [31.8, -7.1],
  algeria: [28.0, 1.7],
  tunisia: [34.0, 9.5],
  jordan: [31.2, 36.5],
  kuwait: [29.3, 47.6],
  serbia: [44.0, 20.9],
  croatia: [45.1, 15.2],
  romania: [45.9, 24.9],
  hungary: [47.2, 19.5],
  bulgaria: [42.7, 25.5],
  czech: [49.8, 15.5],
  netherlands: [52.1, 5.3],
  belgium: [50.8, 4.5],
  sweden: [62.0, 16.0],
  norway: [64.0, 12.0],
  finland: [64.0, 26.0],
  denmark: [56.0, 10.0],
  switzerland: [46.8, 8.2],
  austria: [47.5, 14.6],
  portugal: [39.4, -8.2],
  ireland: [53.4, -8.0],
  scotland: [56.5, -4.0],
  wales: [52.1, -3.6],
  cuba: [21.5, -79.5],
  haiti: [19.0, -72.3],
  peru: [-10.0, -76.0],
  chile: [-33.0, -71.0],
  ecuador: [-1.8, -78.2],
  bolivia: [-17.0, -65.0],
  panama: [9.0, -79.5],
  guatemala: [15.5, -90.2],
  honduras: [14.6, -87.2],
  nicaragua: [12.9, -85.2],

  // Major cities
  kyiv: [50.45, 30.52],
  moscow: [55.76, 37.62],
  beijing: [39.9, 116.4],
  shanghai: [31.23, 121.47],
  taipei: [25.03, 121.57],
  "tel aviv": [32.08, 34.78],
  jerusalem: [31.77, 35.23],
  tehran: [35.69, 51.39],
  baghdad: [33.31, 44.37],
  damascus: [33.51, 36.29],
  kabul: [34.53, 69.17],
  islamabad: [33.69, 73.04],
  "new delhi": [28.61, 77.21],
  delhi: [28.61, 77.21],
  mumbai: [19.08, 72.88],
  pyongyang: [39.02, 125.75],
  seoul: [37.57, 126.98],
  tokyo: [35.68, 139.69],
  ankara: [39.93, 32.86],
  istanbul: [41.01, 28.98],
  cairo: [30.04, 31.24],
  tripoli: [32.9, 13.18],
  khartoum: [15.59, 32.53],
  nairobi: [1.29, 36.82],
  lagos: [6.45, 3.39],
  johannesburg: [-26.2, 28.04],
  riyadh: [24.69, 46.72],
  dubai: [25.2, 55.27],
  doha: [25.29, 51.53],
  beirut: [33.89, 35.5],
  amman: [31.95, 35.93],
  london: [51.51, -0.13],
  paris: [48.86, 2.35],
  berlin: [52.52, 13.41],
  rome: [41.9, 12.5],
  madrid: [40.42, -3.7],
  warsaw: [52.23, 21.01],
  brussels: [50.85, 4.35],
  amsterdam: [52.37, 4.9],
  vienna: [48.21, 16.37],
  athens: [37.98, 23.73],
  stockholm: [59.33, 18.07],
  oslo: [59.91, 10.75],
  helsinki: [60.17, 24.94],
  copenhagen: [55.68, 12.57],
  lisbon: [38.72, -9.14],
  dublin: [53.35, -6.26],
  bucharest: [44.43, 26.1],
  budapest: [47.5, 19.04],
  prague: [50.08, 14.44],
  washington: [38.91, -77.04],
  "new york": [40.71, -74.01],
  "los angeles": [34.05, -118.24],
  chicago: [41.88, -87.63],
  toronto: [43.65, -79.38],
  ottawa: [45.42, -75.7],
  "mexico city": [19.43, -99.13],
  "sao paulo": [-23.55, -46.63],
  "buenos aires": [-34.6, -58.38],
  bogota: [4.71, -74.07],
  lima: [-12.05, -77.04],
  santiago: [-33.45, -70.67],
  caracas: [10.48, -66.9],
  sydney: [-33.87, 151.21],
  melbourne: [-37.81, 144.96],
  canberra: [-35.28, 149.13],
  aleppo: [36.2, 37.15],
  kharkiv: [49.99, 36.23],
  odesa: [46.48, 30.73],
  mariupol: [47.1, 37.55],
  bakhmut: [48.6, 38.0],
  kherson: [46.64, 32.62],
  crimea: [44.95, 34.1],
  donbas: [48.0, 38.0],
  rafah: [31.28, 34.24],
  "west bank": [32.0, 35.2],
  houthi: [15.35, 44.21],
  "red sea": [20.0, 38.0],
  nato: [50.88, 4.43],
  pentagon: [38.87, -77.06],
  kremlin: [55.75, 37.62],
  "white house": [38.9, -77.04],
  "un ": [40.75, -73.97],
  "united nations": [40.75, -73.97],
};

// Subreddit fallback coordinates when no keyword matches
const SUBREDDIT_FALLBACK: Record<string, [number, number]> = {
  middleeast: [33.0, 44.0],
  worldnews: [20.0, 0.0], // will get random global spread
  geopolitics: [30.0, 20.0],
  BreakingNews: [38.9, -77.0],
  OSINT: [50.0, 30.0],
};

/**
 * Extract geographic coordinates from a post title via keyword matching.
 * Returns [latitude, longitude] or null if no match.
 */
function extractCoordsFromTitle(title: string): [number, number] | null {
  const lower = title.toLowerCase();

  // Try multi-word keywords first (more specific), then single-word
  const sortedKeywords = Object.entries(LOCATION_KEYWORDS).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [keyword, coords] of sortedKeywords) {
    if (lower.includes(keyword)) {
      return coords;
    }
  }

  return null;
}

/**
 * Add random scatter of +/- 0.5 degrees to avoid pin stacking.
 */
function scatter(coord: number): number {
  return coord + (Math.random() - 0.5) * 1.0;
}

/**
 * Derive a tone score from Reddit upvote_ratio.
 * upvote_ratio ranges 0..1. We map it to -10..10:
 *   0.5 ratio (maximally controversial) = -5
 *   1.0 ratio (universally upvoted) = +5
 *   0.0 ratio (universally downvoted) = -10
 * Formula: (ratio - 0.5) * 20 - scale so 0.5->-5, 1.0->5
 * Adjusted: tone = (ratio * 20) - 10  =>  0->-10, 0.5->0, 1.0->10
 * Per spec: 0.5 = -5, 1.0 = 5   =>  tone = (ratio - 0.5) * 20
 * Check: 0.5 -> 0*20 = 0 ... not matching spec.
 * Spec says 0.5 = -5, 1.0 = 5 => linear: tone = ratio * 20 - 15
 * Check: 0.5*20-15 = -5 yes, 1.0*20-15 = 5 yes, 0.0*20-15 = -15 (clamp to -10)
 */
function toneFromRatio(ratio: number): number {
  const raw = ratio * 20 - 15;
  return Math.max(-10, Math.min(10, Math.round(raw * 10) / 10));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface RedditPost {
  data: {
    id: string;
    title: string;
    url: string;
    permalink: string;
    subreddit: string;
    is_self: boolean;
    stickied: boolean;
    score: number;
    upvote_ratio: number;
    created_utc: number;
    thumbnail?: string;
    preview?: {
      images?: Array<{
        source?: { url?: string };
      }>;
    };
  };
}

/**
 * Fetch social intelligence from Reddit's public JSON API.
 * Pulls from r/worldnews, r/geopolitics, r/BreakingNews, r/OSINT, r/middleeast.
 * No authentication required.
 */
export async function fetchRedditIntel(): Promise<NewsArticle[]> {
  try {
    const res = await fetch(REDDIT_URL, {
      signal: AbortSignal.timeout(8_000),
      headers: {
        "User-Agent": "WorldView/1.0 (OSINT Dashboard)",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      console.error("Reddit API error:", res.status, await res.text().catch(() => ""));
      return [];
    }

    const json = await res.json();
    const children: RedditPost[] = json?.data?.children ?? [];

    const articles: NewsArticle[] = [];

    for (const post of children) {
      const d = post.data;

      // Filter: skip stickied posts
      if (d.stickied) continue;

      // Filter: skip low-score posts
      if (d.score < 10) continue;

      // Filter: skip self-posts with no external link
      if (d.is_self) continue;

      // Determine URL
      const url = d.is_self
        ? `https://reddit.com${d.permalink}`
        : d.url;

      // Extract coordinates from title
      let coords = extractCoordsFromTitle(d.title);

      if (!coords) {
        // Fallback: assign based on subreddit
        const subLower = d.subreddit.toLowerCase();
        const fallback = SUBREDDIT_FALLBACK[d.subreddit] ?? SUBREDDIT_FALLBACK[subLower];

        if (fallback) {
          if (subLower === "worldnews") {
            // Random global spread for r/worldnews
            coords = [
              (Math.random() - 0.5) * 120, // -60 to 60 lat
              (Math.random() - 0.5) * 320, // -160 to 160 lon
            ];
          } else {
            coords = fallback;
          }
        } else {
          // Last resort: random global placement
          coords = [
            (Math.random() - 0.5) * 120,
            (Math.random() - 0.5) * 320,
          ];
        }
      }

      // Extract image URL if available
      let imageUrl: string | undefined;
      const previewImage = d.preview?.images?.[0]?.source?.url;
      if (previewImage) {
        // Reddit HTML-encodes the preview URL
        imageUrl = previewImage.replace(/&amp;/g, "&");
      } else if (
        d.thumbnail &&
        d.thumbnail !== "self" &&
        d.thumbnail !== "default" &&
        d.thumbnail !== "nsfw" &&
        d.thumbnail.startsWith("http")
      ) {
        imageUrl = d.thumbnail;
      }

      articles.push({
        id: `reddit-${d.id}`,
        title: d.title,
        url,
        source: `r/${d.subreddit}`,
        latitude: scatter(coords[0]),
        longitude: scatter(coords[1]),
        date: new Date(d.created_utc * 1000).toISOString(),
        language: "English",
        tone: toneFromRatio(d.upvote_ratio),
        imageUrl,
      });
    }

    return articles;
  } catch (err) {
    console.error("Reddit intel fetch error:", err);
    return [];
  }
}
