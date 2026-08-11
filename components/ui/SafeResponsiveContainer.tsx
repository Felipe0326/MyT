"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from "react";
import { ResponsiveContainer } from "recharts";

const ChartVisibilityContext = createContext(true);

type ChartVisibilityProviderProps = {
  active: boolean;
  children: ReactNode;
};

export function ChartVisibilityProvider({
  active,
  children,
}: ChartVisibilityProviderProps) {
  return (
    <ChartVisibilityContext.Provider value={active}>
      {children}
    </ChartVisibilityContext.Provider>
  );
}

type SafeResponsiveContainerProps = {
  children: ReactElement;
  className?: string;
  style?: CSSProperties;
  debounceMs?: number;
};

/**
 * Evita que Recharts intente pintar cuando su contenedor todavía mide 0 x 0.
 * Esto ocurre al cambiar entre tableros que permanecen montados pero ocultos.
 */
export function SafeResponsiveContainer({
  children,
  className = "h-full w-full min-w-0",
  style,
  debounceMs = 60,
}: SafeResponsiveContainerProps) {
  const dashboardIsVisible = useContext(ChartVisibilityContext);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!dashboardIsVisible) {
      setReady(false);
      return;
    }

    const element = containerRef.current;
    if (!element) return;

    let frameId = 0;
    let timeoutId = 0;

    const measure = () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);

      const rect = element.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) {
        setReady(false);
        return;
      }

      timeoutId = window.setTimeout(() => {
        frameId = window.requestAnimationFrame(() => {
          const nextRect = element.getBoundingClientRect();
          const hasUsableSize = nextRect.width > 1 && nextRect.height > 1;
          setReady((current) => (current === hasUsableSize ? current : hasUsableSize));
        });
      }, debounceMs);
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [dashboardIsVisible, debounceMs]);

  return (
    <div ref={containerRef} className={className} style={style}>
      {dashboardIsVisible && ready && (
        <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
          {children}
        </ResponsiveContainer>
      )}
    </div>
  );
}
