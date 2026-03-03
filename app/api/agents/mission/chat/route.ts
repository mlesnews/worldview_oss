import { NextRequest, NextResponse } from "next/server";
import {
  handleChatMessage,
  getChatHistory,
  clearChatHistory,
  abortChat,
  isChatGenerating,
} from "@/lib/agents/specialist-chat";
import type { DeploymentArea } from "@/lib/agents/types";

export async function GET() {
  const messages = getChatHistory();
  return NextResponse.json({
    messages,
    generating: isChatGenerating(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Abort action
    if (body.action === "abort") {
      abortChat();
      return NextResponse.json({ success: true });
    }

    // Chat message
    const { message, deploymentArea } = body as {
      message: string;
      deploymentArea?: DeploymentArea;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message required" }, { status: 400 });
    }

    // Non-blocking: fire and forget (responses stream via SSE)
    const area = deploymentArea || null;
    handleChatMessage(message, area).catch((err) => {
      console.error("[specialist-chat] Error:", err);
    });

    return NextResponse.json({ success: true, messageId: `asst-${Date.now()}` });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  clearChatHistory();
  return NextResponse.json({ success: true });
}
