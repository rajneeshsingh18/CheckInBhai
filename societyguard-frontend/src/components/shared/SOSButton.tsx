"use client";

import { useState, useRef, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SOSButtonProps {
  onTrigger: () => void;
  className?: string;
  holdTimeMs?: number; // default 3000ms (3 seconds)
}

export default function SOSButton({ onTrigger, className, holdTimeMs = 3000 }: SOSButtonProps) {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const startHold = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsHolding(true);
    setProgress(0);
    startTimeRef.current = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentProgress = Math.min((elapsed / holdTimeMs) * 100, 100);
      setProgress(currentProgress);

      if (elapsed >= holdTimeMs) {
        onTrigger();
        cancelHold();
      } else {
        timerRef.current = requestAnimationFrame(tick);
      }
    };

    timerRef.current = requestAnimationFrame(tick);
  };

  const cancelHold = () => {
    setIsHolding(false);
    setProgress(0);
    if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        cancelAnimationFrame(timerRef.current);
      }
    };
  }, []);

  // Compute SVG circular progress stroke dash
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className={cn("flex flex-col items-center justify-center p-6 text-center select-none", className)}>
      <div
        className="relative cursor-pointer touch-none"
        onMouseDown={startHold}
        onMouseUp={cancelHold}
        onMouseLeave={cancelHold}
        onTouchStart={startHold}
        onTouchEnd={cancelHold}
      >
        {/* Background circular progress border */}
        <svg className="w-36 h-36 transform -rotate-90">
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-gray-200 fill-none"
            strokeWidth="8"
          />
          <circle
            cx="72"
            cy="72"
            r={radius}
            className="stroke-red-600 fill-none transition-all duration-75 ease-out"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>

        {/* Core SOS Button */}
        <div
          className={cn(
            "absolute top-4 left-4 w-28 h-28 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center shadow-lg transition-transform border-4 border-red-500/30",
            isHolding ? "scale-95 animate-pulse bg-red-800" : "hover:scale-105 active:scale-95"
          )}
        >
          <AlertTriangle className="w-8 h-8 text-white mb-1.5" />
          <span className="text-sm font-black tracking-widest uppercase">HOLD SOS</span>
        </div>
      </div>

      <p className="mt-4 text-xs font-bold text-gray-500 uppercase tracking-widest">
        {isHolding ? `Holding... ${Math.round(progress)}%` : "Hold for 3 seconds to trigger"}
      </p>
    </div>
  );
}
