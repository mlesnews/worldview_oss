"use client";

import { useCallback, useState, useEffect } from "react";
import { useWorldViewStore } from "@/stores/worldview-store";
import CalendarPicker from "./CalendarPicker";
import VoiceButton from "./VoiceButton";

/** Inline SVG calendar icon (18x18) */
function CalendarIcon() {
  return (
    <svg
      width="18"
      height="18"
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

const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

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

  // Slider value = total minutes in day (0-1439)
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

  // Day progress (0-100%)
  const progressPct = mounted ? (sliderValue / 1439) * 100 : 0;

  return (
    <div
      className={`timeline-command-bar ${!isLive ? "timeline-command-bar-historical" : ""}`}
    >
      {/* Row 1: Main controls */}
      <div className="timeline-row-main">
        {/* Voice button */}
        <VoiceButton />

        <div className={`timeline-separator ${!isLive ? "timeline-separator-historical" : ""}`} />

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
          className={`text-[12px] tracking-wider flex-shrink-0 ml-3 font-mono ${
            isLive ? "text-green-500/70" : "timeline-historical-indicator"
          }`}
        >
          {dateStr}
        </span>

        <div className={`timeline-separator ${!isLive ? "timeline-separator-historical" : ""}`} />

        {/* Time slider */}
        <input
          type="range"
          min={0}
          max={1439}
          value={mounted ? sliderValue : 0}
          onChange={handleSliderChange}
          className={`timeline-slider ${!isLive ? "timeline-slider-historical" : ""}`}
          title={timeStr}
        />

        <div className={`timeline-separator ${!isLive ? "timeline-separator-historical" : ""}`} />

        {/* Time readout */}
        <span
          className={`text-[12px] tracking-wider flex-shrink-0 font-mono ${
            isLive ? "text-green-500 hud-glow" : "timeline-historical-indicator"
          }`}
        >
          {timeStr}
        </span>

        <div className={`timeline-separator ${!isLive ? "timeline-separator-historical" : ""}`} />

        {/* LIVE / HISTORICAL badge */}
        {isLive ? (
          <button
            className="timeline-live-badge timeline-live-badge-active"
            onClick={resetToLive}
            title="Live mode active"
          >
            <span className="timeline-live-dot" />
            LIVE
          </button>
        ) : (
          <>
            <span className="timeline-historical-badge">HISTORICAL</span>
            <button
              className="timeline-live-badge ml-2"
              onClick={resetToLive}
              title="Return to live"
            >
              LIVE
            </button>
          </>
        )}
      </div>

      {/* Row 2: Tick marks */}
      <div className="timeline-tick-container">
        <div className="timeline-tick-track">
          {TICK_HOURS.map((h) => (
            <div key={h} className="timeline-tick">
              <div className="timeline-tick-mark" />
              <span className="timeline-hour-label">
                {String(h).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Day progress bar */}
      <div className="timeline-progress">
        <div
          className={`timeline-progress-fill ${!isLive ? "timeline-progress-fill-historical" : ""}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
