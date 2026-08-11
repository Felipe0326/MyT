"use client";

import React from "react";

type MotionOnlyProps = {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  whileInView?: unknown;
  layout?: unknown;
  variants?: unknown;
  viewport?: unknown;
};

function cleanMotionProps<T extends MotionOnlyProps>(props: T) {
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

type MotionDivProps = React.ComponentPropsWithoutRef<"div"> & MotionOnlyProps;
type MotionSpanProps = React.ComponentPropsWithoutRef<"span"> & MotionOnlyProps;
type MotionTrProps = React.ComponentPropsWithoutRef<"tr"> & MotionOnlyProps;

const MotionDiv = React.forwardRef<HTMLDivElement, MotionDivProps>((props, ref) => (
  <div ref={ref} {...cleanMotionProps(props)} />
));
MotionDiv.displayName = "MotionDiv";

const MotionSpan = React.forwardRef<HTMLSpanElement, MotionSpanProps>((props, ref) => (
  <span ref={ref} {...cleanMotionProps(props)} />
));
MotionSpan.displayName = "MotionSpan";

const MotionTr = React.forwardRef<HTMLTableRowElement, MotionTrProps>((props, ref) => (
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
