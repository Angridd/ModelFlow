"use client";

import { useEffect, useState } from "react";

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function useCountUp(target: number, duration = 1200, decimals = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(0);
      return;
    }

    if (prefersReducedMotion() || duration <= 0) {
      setValue(Number(target.toFixed(decimals)));
      return;
    }

    let animationFrame = 0;
    const startedAt = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const nextValue = target * easeOutCubic(progress);

      setValue(Number(nextValue.toFixed(decimals)));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
      }
    };

    setValue(0);
    animationFrame = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration, decimals]);

  return value;
}
