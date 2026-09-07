"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export type DashboardUpdateNoticeValue = {
  type: "success" | "error";
  message: string;
};

export function DashboardUpdateNotice({
  notice,
  onDismiss,
  duration = 4_000,
}: {
  notice: DashboardUpdateNoticeValue | null;
  onDismiss: () => void;
  duration?: number;
}) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => onDismissRef.current(), duration);
    return () => window.clearTimeout(timeout);
  }, [duration, notice]);

  if (!notice) return null;

  const isSuccess = notice.type === "success";

  return (
    <div
      className={isSuccess
        ? "flex items-center gap-3 rounded-2xl border border-[#cfdac9] bg-[#f3f7f0] px-5 py-4 text-sm font-semibold text-[#46583d]"
        : "flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700"}
      role={isSuccess ? "status" : "alert"}
      aria-live="polite"
    >
      {isSuccess
        ? <CheckCircle2 className="h-5 w-5 shrink-0" />
        : <AlertCircle className="h-5 w-5 shrink-0" />}
      <span>{notice.message}</span>
    </div>
  );
}
