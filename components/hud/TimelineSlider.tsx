"use client";

import { useCallback, useState, useEffect } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";
import CalendarPicker from "./CalendarPicker";

/** Inline SVG calendar icon (16x16) */
function CalendarIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="3" width="14" height="12" rx="1.5" />
      <line x1="1" y1="7" x2="15" y2="7" />
      <line x1="4" y1="1" x2="4" y2="5" />
      <line x1="12" y1="1" x2="12" y2="5" />
    </svg>
  );
}

export default function TimelineSlider() {
  // Suppress hydration mismatch: only render time-sensitive values after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const simulationDate = useWorldViewStore((s) => s.simulationDate);
  const simulationHour = useWorldViewStore((s) => s.simulationHour);
  const simulationMinute = useWorldViewStore((s) => s.simulationMinute);
  const calendarOpen = useWorldViewStore((s) => s.calendarOpen);
  const isLive = useWorldViewStore((s) => s.isLive);
  const setSimulationTime = useWorldViewStore((s) => s.setSimulationTime);
  const setCalendarOpen = useWorldViewStore((s) => s.setCalendarOpen);
  const resetToLive = useWorldViewStore((s) => s.resetToLive);

  // Slider value = total minutes in day (0–1439)
  const sliderValue = simulationHour * 60 + simulationMinute;

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const totalMinutes = parseInt(e.target.value, 10);
      const hour = Math.floor(totalMinutes / 60);
      const minute = totalMinutes % 60;
      setSimulationTime(hour, minute);
    },
    [setSimulationTime]
  );

  const toggleCalendar = useCallback(() => {
    setCalendarOpen(!calendarOpen);
  }, [calendarOpen, setCalendarOpen]);

  // Format date as YYYY-MM-DD
  const dateStr = mounted ? simulationDate.toISOString().slice(0, 10) : "--";

  // Format time as HH:MMZ
  const timeStr = mounted
    ? `${String(simulationHour).padStart(2, "0")}:${String(simulationMinute).padStart(2, "0")}Z`
    : "--:--Z";

  return (
    <div className="w-full flex justify-center mt-2 mb-1">
      <div className="timeline-bar relative">
        {/* Calendar button */}
        <div className="relative">
          <button
            className="timeline-cal-btn"
            onClick={toggleCalendar}
            title="Select date"
          >
            <CalendarIcon />
          </button>
          {calendarOpen && <CalendarPicker />}
        </div>

        {/* Date readout */}
        <span
          className={`text-[10px] tracking-wider flex-shrink-0 ${
            isLive ? "text-green-500/70" : "timeline-historical-indicator"
          }`}
        >
          {dateStr}
        </span>

        {/* Time slider */}
        <input
          type="range"
          min={0}
          max={1439}
          value={mounted ? sliderValue : 0}
          onChange={handleSliderChange}
          className="timeline-slider"
          title={timeStr}
        />

        {/* Time readout */}
        <span
          className={`text-[10px] tracking-wider flex-shrink-0 ${
            isLive ? "text-green-500 hud-glow" : "timeline-historical-indicator"
          }`}
        >
          {timeStr}
        </span>

        {/* LIVE button */}
        <button
          className={`timeline-live-btn ${isLive ? "timeline-live-btn-active" : ""}`}
          onClick={resetToLive}
          title="Return to live"
        >
          LIVE
        </button>

        {/* Historical mode badge */}
        {!isLive && (
          <span className="text-[8px] tracking-widest text-amber-500/60 flex-shrink-0">
            HISTORICAL
          </span>
        )}
      </div>
    </div>
  );
}
