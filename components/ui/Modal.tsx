"use client";

import { useWorldViewStore } from "@/stores/worldview-store";
import { useEffect, useState, useRef } from "react";

export default function CameraModal() {
  const isOpen = useWorldViewStore((s) => s.cameraModalOpen);
  const camera = useWorldViewStore((s) => s.activeCamera);
  const close = useWorldViewStore((s) => s.closeCameraModal);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [detections, setDetections] = useState<
    { class: string; confidence: number; bbox: number[] }[]
  >([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refresh image periodically via proxy
  useEffect(() => {
    if (!camera || !isOpen) return;

    const loadImage = () => {
      setImgSrc(`/api/cameras/feed?id=${camera.id}&t=${Date.now()}`);
    };

    loadImage();
    const interval = setInterval(loadImage, 5000);
    return () => {
      clearInterval(interval);
      setImgSrc(null);
      setImgLoaded(false);
    };
  }, [camera, isOpen]);

  // Simulate detections only when image is loaded
  useEffect(() => {
    if (!isOpen || !camera || !imgLoaded) {
      setDetections([]);
      return;
    }

    const simulateDetections = () => {
      const types = ["VEHICLE", "PERSON", "TRUCK", "BUS", "MOTORCYCLE"];
      const count = Math.floor(Math.random() * 6) + 2;
      const dets = [];

      for (let i = 0; i < count; i++) {
        dets.push({
          class: types[Math.floor(Math.random() * types.length)],
          confidence: 0.65 + Math.random() * 0.33,
          bbox: [
            Math.random() * 400 + 20,
            Math.random() * 250 + 20,
            30 + Math.random() * 60,
            30 + Math.random() * 50,
          ],
        });
      }
      setDetections(dets);
    };

    simulateDetections();
    const interval = setInterval(simulateDetections, 3000);
    return () => clearInterval(interval);
  }, [isOpen, camera, imgLoaded]);

  // Draw detections on canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!detections.length) return;

    for (const det of detections) {
      const [x, y, w, h] = det.bbox;

      // Box
      ctx.strokeStyle = det.class === "PERSON" ? "#ff3333" : "#00ff41";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, w, h);

      // Corner brackets
      const corner = 6;
      ctx.lineWidth = 2;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(x, y + corner);
      ctx.lineTo(x, y);
      ctx.lineTo(x + corner, y);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(x + w - corner, y);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x + w, y + corner);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(x, y + h - corner);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + corner, y + h);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(x + w - corner, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y + h - corner);
      ctx.stroke();

      // Label
      const label = `${det.class} ${(det.confidence * 100).toFixed(0)}%`;
      ctx.font = "9px monospace";
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const textWidth = ctx.measureText(label).width;
      ctx.fillRect(x, y - 13, textWidth + 6, 13);
      ctx.fillStyle = det.class === "PERSON" ? "#ff3333" : "#00ff41";
      ctx.fillText(label, x + 3, y - 3);
    }

    // Detection count
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(5, 5, 120, 18);
    ctx.fillStyle = "#00ff41";
    ctx.font = "10px monospace";
    ctx.fillText(`DETECTIONS: ${detections.length}`, 10, 17);
  }, [detections]);

  if (!isOpen || !camera) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-[#0a0f0a] border border-green-900/50 rounded-sm max-w-[600px] w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-green-900/30">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${imgLoaded ? "bg-red-500" : "bg-yellow-600"} animate-pulse`} />
            <span className="text-[10px] font-mono text-green-400 tracking-wider">
              CCTV FEED: {camera.name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-mono text-green-700/50">
              {imgLoaded ? "PANOPTIC DETECTION: ACTIVE" : "CONNECTING..."}
            </span>
            <button
              onClick={close}
              className="text-green-700 hover:text-green-400 font-mono text-sm cursor-pointer"
            >
              [X]
            </button>
          </div>
        </div>

        {/* Feed */}
        <div className="relative aspect-video bg-black">
          {imgSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgSrc}
              alt={camera.name}
              className={`w-full h-full object-cover ${imgLoaded ? "opacity-90" : "opacity-0"}`}
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                setImgLoaded(false);
              }}
            />
          )}
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <span className="text-green-700/50 font-mono text-sm">
                  CONNECTING TO FEED...
                </span>
                <div className="w-32 h-0.5 bg-green-900/30 overflow-hidden">
                  <div className="h-full bg-green-500/50 animate-[loading_2s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>
          )}

          {/* Detection overlay canvas */}
          <canvas
            ref={canvasRef}
            width={560}
            height={315}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Timestamp overlay */}
          <div className="absolute bottom-2 left-2 text-[9px] font-mono text-green-400/60 bg-black/50 px-1">
            {new Date().toISOString()} | {camera.city.toUpperCase()}
          </div>

          {/* REC indicator */}
          {imgLoaded && (
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[9px] font-mono text-red-400">REC</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t border-green-900/30 flex justify-between">
          <span className="text-[9px] font-mono text-green-700/50">
            LAT: {camera.latitude.toFixed(4)} | LON:{" "}
            {camera.longitude.toFixed(4)}
          </span>
          <span className="text-[9px] font-mono text-green-700/50">
            SRC: {camera.id.startsWith("cal-") ? "CALTRANS CCTV" :
                  camera.id.startsWith("nyc-") ? "NYC DOT" :
                  camera.id.startsWith("uk-") ? "UK HIGHWAYS" :
                  camera.id.startsWith("hk-") ? "HK TRANSPORT" :
                  camera.id.startsWith("me-") || camera.id.startsWith("eu-") || camera.id.startsWith("intl-")
                    ? "SKYLINE WEBCAMS" :
                  camera.city === "Austin" ? "AUSTIN MOBILITY" :
                  camera.city.toUpperCase() + " DOT"}
          </span>
        </div>
      </div>
    </div>
  );
}
