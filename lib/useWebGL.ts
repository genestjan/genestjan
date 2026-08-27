'use client';
import { useEffect, useState } from 'react';

/** True only once we have confirmed a WebGL context can actually be created. */
export function useWebGL() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      setOk(!!gl);
      // Release the probe context immediately; contexts are a limited resource.
      const lose = gl && (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context');
      lose?.loseContext();
    } catch {
      setOk(false);
    }
  }, []);
  return ok;
}
