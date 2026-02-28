"use client";

import { useEffect, useState } from "react";
import { getZuluTime, getHudDate } from "@/lib/utils";

export default function Clock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");

  useEffect(() => {
    const update = () => {
      setTime(getZuluTime());
      setDate(getHudDate());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-end font-mono">
      <span className="text-[10px] text-green-500/70">
        BSC {date} {time.substring(11, 19)}
      </span>
    </div>
  );
}
