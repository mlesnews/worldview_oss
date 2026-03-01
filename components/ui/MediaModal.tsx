"use client";

import { useWorldViewStore } from "@/stores/worldview-store";

export default function MediaModal() {
  const isOpen = useWorldViewStore((s) => s.mediaModalOpen);
  const content = useWorldViewStore((s) => s.mediaModalContent);
  const close = useWorldViewStore((s) => s.closeMediaModal);

  if (!isOpen || !content) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#0a0f0a] border border-green-900/50 rounded-sm max-w-[640px] w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-green-900/30">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400 tracking-wider">
              LIVE STREAM
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-green-700/50 truncate max-w-[300px]">
              {content.title}
            </span>
            <button
              onClick={close}
              className="text-green-700 hover:text-green-400 font-mono text-sm cursor-pointer"
            >
              [X]
            </button>
          </div>
        </div>

        {/* YouTube Embed */}
        <div className="relative aspect-video bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${content.videoId}?autoplay=1&mute=1`}
            className="w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
            title={content.title}
          />

          {/* Scanline overlay for HUD feel */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,65,0.03) 2px, rgba(0,255,65,0.03) 4px)",
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-green-900/30 flex justify-between items-center">
          <span className="text-[9px] font-mono text-green-700/50">
            SRC: YOUTUBE LIVE
          </span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[9px] font-mono text-red-400">LIVE</span>
          </div>
        </div>
      </div>
    </div>
  );
}
