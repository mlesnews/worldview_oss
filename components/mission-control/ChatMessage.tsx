"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import type { ChatMessageClient, AgentIntelItemClient } from "@/types";

const CATEGORY_COLORS: Record<string, string> = {
  news: "border-cyan-700/50",
  military: "border-red-700/50",
  disasters: "border-amber-700/50",
  general: "border-purple-700/50",
};

const CATEGORY_LABELS: Record<string, string> = {
  news: "NEWS",
  military: "MIL",
  disasters: "DISASTER",
  general: "GEOINT",
};

function AgentResultCard({ item }: { item: AgentIntelItemClient }) {
  const borderColor = CATEGORY_COLORS[item.category] || "border-green-900/30";
  const label = CATEGORY_LABELS[item.category] || item.category.toUpperCase();

  return (
    <div className={`border-l-2 ${borderColor} pl-2 py-1.5 my-1`}>
      <div className="flex items-center gap-2">
        <span className="text-[7px] font-mono tracking-wider text-green-600/50">
          [{label}]
        </span>
        {item.sourceUrl ? (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] font-mono text-green-400 hover:text-green-300 underline underline-offset-2 decoration-green-700/40 hover:decoration-green-500/60 transition-colors truncate"
          >
            {item.title}
          </a>
        ) : (
          <span className="text-[9px] font-mono text-green-400 truncate">
            {item.title}
          </span>
        )}
      </div>
      <div className="text-[8px] font-mono text-green-600/60 mt-0.5 leading-relaxed">
        {item.summary}
      </div>
      <div className="flex items-center gap-3 mt-0.5">
        {item.latitude !== 0 && (
          <span className="text-[7px] font-mono text-green-700/40">
            {item.latitude.toFixed(2)}°, {item.longitude.toFixed(2)}°
          </span>
        )}
        {item.confidence > 0 && (
          <span className="text-[7px] font-mono text-green-700/40">
            CONF: {(item.confidence * 100).toFixed(0)}%
          </span>
        )}
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[7px] font-mono text-green-700/40 hover:text-green-500/60 transition-colors truncate max-w-[200px]"
          >
            {new URL(item.sourceUrl).hostname}
          </a>
        )}
      </div>
    </div>
  );
}

/** Renders markdown with HUD-styled elements */
function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      components={{
        p: ({ children }) => (
          <p className="text-[9px] font-mono text-green-400/90 leading-relaxed mb-2 last:mb-0">
            {children}
          </p>
        ),
        strong: ({ children }) => (
          <strong className="text-green-300 font-bold">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="text-green-500/80 italic">{children}</em>
        ),
        ul: ({ children }) => (
          <ul className="list-none ml-2 mb-2 last:mb-0 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-none ml-2 mb-2 last:mb-0 space-y-0.5 counter-reset-item">{children}</ol>
        ),
        li: ({ children }) => (
          <li className="text-[9px] font-mono text-green-400/90 leading-relaxed before:content-['▸_'] before:text-green-600/50">
            {children}
          </li>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-green-400 underline underline-offset-2 decoration-green-700/40 hover:decoration-green-500/60 hover:text-green-300 transition-colors"
          >
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="text-[8px] font-mono text-green-300 bg-green-950/50 px-1 py-0.5 rounded">
            {children}
          </code>
        ),
        h1: ({ children }) => (
          <div className="text-[10px] font-mono text-green-400 tracking-wide font-bold mb-1 mt-2 first:mt-0">
            {children}
          </div>
        ),
        h2: ({ children }) => (
          <div className="text-[9px] font-mono text-green-400 tracking-wide font-bold mb-1 mt-2 first:mt-0">
            {children}
          </div>
        ),
        h3: ({ children }) => (
          <div className="text-[9px] font-mono text-green-500/80 tracking-wide font-bold mb-1 mt-1 first:mt-0">
            {children}
          </div>
        ),
        hr: () => (
          <div className="border-t border-green-900/30 my-2" />
        ),
        blockquote: ({ children }) => (
          <div className="border-l-2 border-green-700/30 pl-2 ml-1 my-1 text-green-500/70">
            {children}
          </div>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}

interface Props {
  message: ChatMessageClient;
}

export default function ChatMessage({ message }: Props) {
  const [expanded, setExpanded] = useState(true); // Default expanded to show links
  const isUser = message.role === "user";
  const isAgentResult = message.role === "agent_result";
  const results = message.agentResults || [];

  if (isAgentResult) {
    return (
      <div className="px-3 py-1">
        <button
          onClick={() => results.length > 0 && setExpanded(!expanded)}
          className="flex items-center gap-2 text-[8px] font-mono tracking-wide text-green-500/70 hover:text-green-400 cursor-pointer transition-colors"
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${
            message.isStreaming
              ? "bg-amber-400 animate-pulse"
              : results.length > 0
              ? "bg-green-400"
              : "bg-red-500/60"
          }`} />
          <span>{message.content}</span>
          {results.length > 0 && (
            <span className="text-green-700/40">{expanded ? "[-]" : `[+${results.length}]`}</span>
          )}
        </button>
        {expanded && results.length > 0 && (
          <div className="ml-4 mt-1 max-h-64 overflow-y-auto">
            {results.map((r) => (
              <AgentResultCard key={r.id} item={r} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`px-3 py-2 ${isUser ? "flex justify-end" : ""}`}>
      <div
        className={`max-w-[85%] ${
          isUser
            ? "bg-green-950/40 border border-green-700/30 rounded px-3 py-2"
            : ""
        }`}
      >
        {isUser && (
          <div className="text-[7px] font-mono text-green-600/40 tracking-wide mb-1">
            OPERATOR
          </div>
        )}
        {!isUser && !isAgentResult && (
          <div className="text-[7px] font-mono text-green-500/50 tracking-wide mb-1">
            SPECIALIST {message.isStreaming ? "..." : ""}
          </div>
        )}
        <div className="break-words">
          <MarkdownContent content={message.content} />
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-3 bg-green-400/70 ml-0.5 animate-pulse align-middle" />
          )}
        </div>
      </div>
    </div>
  );
}
