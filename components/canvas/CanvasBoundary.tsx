'use client';
import { Component, type ReactNode } from 'react';
import CanvasFallback from './CanvasFallback';

/**
 * The hero canvas must never be able to take the page down.
 *
 * React Three Fiber throws when it cannot acquire a WebGL context (older
 * devices, GPU blocklists, hardware acceleration disabled, headless). Without
 * a boundary that exception propagates to the root and the whole site renders
 * "Application error" instead of the content. Falling back to the static
 * gradient poster keeps the hero intact.
 */
export default class CanvasBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Hero canvas failed, using static fallback:', error);
    }
  }

  render() {
    return this.state.failed ? <CanvasFallback /> : this.props.children;
  }
}
