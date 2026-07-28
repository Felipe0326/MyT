"use client";

import React from "react";

function cleanMotionProps(props: any) {
  const {
    initial,
    animate,
    exit,
    transition,
    whileHover,
    whileTap,
    whileInView,
    layout,
    variants,
    viewport,
    ...rest
  } = props;
  void initial;
  void animate;
  void exit;
  void transition;
  void whileHover;
  void whileTap;
  void whileInView;
  void layout;
  void variants;
  void viewport;
  return rest;
}

const MotionDiv = React.forwardRef<HTMLDivElement, any>((props, ref) => (
  <div ref={ref} {...cleanMotionProps(props)} />
));
MotionDiv.displayName = "MotionDiv";

const MotionSpan = React.forwardRef<HTMLSpanElement, any>((props, ref) => (
  <span ref={ref} {...cleanMotionProps(props)} />
));
MotionSpan.displayName = "MotionSpan";

const MotionTr = React.forwardRef<HTMLTableRowElement, any>((props, ref) => (
  <tr ref={ref} {...cleanMotionProps(props)} />
));
MotionTr.displayName = "MotionTr";

export const motion = {
  div: MotionDiv,
  span: MotionSpan,
  tr: MotionTr,
};

export function AnimatePresence({ children }: { children: React.ReactNode; [key: string]: unknown }) {
  return <>{children}</>;
}
