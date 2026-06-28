"use client";

import React, { useState, useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
}

export default function PullToRefresh({ onRefresh, children, className }: PullToRefreshProps) {
  const [pullProgress, setPullProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullThreshold = 75; // px

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Only pull if container is scrolled to the very top
      if (window.scrollY === 0) {
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!pulling.current) return;
      const currentY = e.touches[0].clientY;
      const diff = currentY - startY.current;

      if (diff > 0) {
        // Apply resistance
        const progress = Math.min(diff * 0.45, pullThreshold + 20);
        setPullProgress(progress);
        
        // Prevent default pull-to-refresh of mobile browsers
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    };

    const handleTouchEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;

      if (pullProgress >= pullThreshold) {
        setRefreshing(true);
        setPullProgress(pullThreshold);
        try {
          await onRefresh();
        } catch (e) {
          console.warn("Pull to refresh failed", e);
        } finally {
          setRefreshing(false);
          setPullProgress(0);
        }
      } else {
        setPullProgress(0);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [pullProgress, onRefresh]);

  return (
    <div ref={containerRef} className={`relative min-h-screen ${className}`}>
      {/* Pull Indicator */}
      {pullProgress > 0 && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center pointer-events-none transition-all z-40"
          style={{
            top: `${Math.min(pullProgress - 35, 15)}px`,
            opacity: Math.min(pullProgress / pullThreshold, 1),
          }}
        >
          <div className="bg-white rounded-full p-2 border border-gray-200 shadow-md flex items-center justify-center">
            {refreshing ? (
              <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
            ) : (
              <div
                className="w-5 h-5 rounded-full border-2 border-orange-600 border-t-transparent animate-spin"
                style={{
                  animationPlayState: pullProgress >= pullThreshold ? "running" : "paused",
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Content wrapper */}
      <div
        style={{
          transform: pullProgress > 0 ? `translateY(${pullProgress}px)` : "none",
          transition: pulling.current ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
