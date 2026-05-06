"use client";

import { useEffect, useState } from "react";

export default function LiveClock({ timezone }: { timezone: string }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      try {
        const formatted = new Intl.DateTimeFormat("es", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(new Date());
        setTime(formatted);
      } catch {
        setTime("");
      }
    };
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [timezone]);

  if (!time) return null;

  return (
    <div className="ml-auto text-right">
      <p className="text-xs text-slate-500">Hora actual</p>
      <p className="font-mono text-base font-medium text-white">{time}</p>
    </div>
  );
}
