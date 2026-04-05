import { NextResponse } from "next/server";
import type { VcFundingEvent } from "@/types";

// Static mock — top AI/crypto funding rounds with real coords
const FUNDING_EVENTS: VcFundingEvent[] = [
  { id: "vc-1", company: "Anthropic", amountUsd: 7_500_000_000, round: "Series E", investors: "Amazon, Google, Spark Capital", latitude: 37.7749, longitude: -122.4194, date: "2025-11-21", sector: "AI/ML" },
  { id: "vc-2", company: "xAI", amountUsd: 6_000_000_000, round: "Series C", investors: "Valor Equity Partners, Sequoia", latitude: 30.2672, longitude: -97.7431, date: "2025-12-19", sector: "AI/ML" },
  { id: "vc-3", company: "Databricks", amountUsd: 10_000_000_000, round: "Series J", investors: "Thrive Capital, a16z, DST Global", latitude: 37.7749, longitude: -122.4194, date: "2025-12-17", sector: "AI/Data" },
  { id: "vc-4", company: "OpenAI", amountUsd: 6_600_000_000, round: "Series D", investors: "Thrive Capital, Microsoft, SoftBank", latitude: 37.7749, longitude: -122.4194, date: "2025-10-02", sector: "AI/ML" },
  { id: "vc-5", company: "Figure AI", amountUsd: 675_000_000, round: "Series B", investors: "Microsoft, NVIDIA, Jeff Bezos", latitude: 37.4089, longitude: -122.1468, date: "2024-02-29", sector: "Robotics" },
  { id: "vc-6", company: "Ripple", amountUsd: 200_000_000, round: "Series C", investors: "Various", latitude: 37.7749, longitude: -122.4194, date: "2024-01-15", sector: "Crypto/Fintech" },
  { id: "vc-7", company: "Mistral AI", amountUsd: 640_000_000, round: "Series B", investors: "General Catalyst, a16z, NVIDIA", latitude: 48.8566, longitude: 2.3522, date: "2024-06-11", sector: "AI/ML" },
  { id: "vc-8", company: "Worldcoin", amountUsd: 135_000_000, round: "Series C", investors: "a16z, Khosla, Bain Capital", latitude: 37.7749, longitude: -122.4194, date: "2024-05-20", sector: "Crypto/Identity" },
  { id: "vc-9", company: "Cohere", amountUsd: 500_000_000, round: "Series D", investors: "PSP, NVIDIA, Salesforce", latitude: 43.6532, longitude: -79.3832, date: "2024-06-05", sector: "AI/ML" },
  { id: "vc-10", company: "Safe Superintelligence", amountUsd: 1_000_000_000, round: "Series A", investors: "a16z, Sequoia, DST", latitude: 37.4419, longitude: -122.143, date: "2025-09-04", sector: "AI Safety" },
];

export async function GET() {
  return NextResponse.json(FUNDING_EVENTS);
}
