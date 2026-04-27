"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Delay before the element starts animating, in ms */
  delay?: number;
  /** Initial Y offset in px before reveal */
  y?: number;
};

/**
 * Smooth scroll-triggered fade + lift. Uses IntersectionObserver so it
 * only reveals once and doesn't pay attention afterward. Respects
 * prefers-reduced-motion (the transition becomes a no-op via CSS).
 */
export function Reveal({ children, className, delay = 0, y = 16 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        transitionDelay: shown ? `${delay}ms` : "0ms",
        transform: shown ? "translate3d(0,0,0)" : `translate3d(0,${y}px,0)`,
        opacity: shown ? 1 : 0,
      }}
      className={cn(
        "motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out",
        className,
      )}
    >
      {children}
    </div>
  );
}
