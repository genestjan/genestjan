'use client';
import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useDeviceTier, NODE_COUNT } from '@/lib/useDeviceTier';
import { useMousePosition } from '@/lib/useMousePosition';

const BLUEPRINT = new THREE.Color('#1E3A5F');
const CURRENT = new THREE.Color('#4FD1E0');
const SIGNAL = new THREE.Color('#FFB03A');

/** Drifting field of connected nodes. Amber pulses travel the links like
 *  current through a circuit. Mesh warps toward the cursor with easing. */
function NodeField({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const lines = useRef<THREE.LineSegments>(null);
  const group = useRef<THREE.Group>(null);
  const mouse = useMousePosition();
  const { viewport } = useThree();

  const { positions, colors, linePositions, lineColors, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const spread = 26;

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.62;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 16 - 4;
      seeds[i] = Math.random() * Math.PI * 2;
      const c = Math.random() > 0.82 ? CURRENT : BLUEPRINT;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }

    // Link nearby nodes. Capped so the line buffer stays small on mobile.
    const maxLinks = Math.min(count * 2, 2600);
    const lp: number[] = [];
    const lc: number[] = [];
    const threshold = 2.6;
    outer: for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < Math.min(i + 26, count); j++) {
        const dx = positions[i * 3] - positions[j * 3];
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1];
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < threshold * threshold) {
          lp.push(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
          lp.push(positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]);
          lc.push(BLUEPRINT.r, BLUEPRINT.g, BLUEPRINT.b, BLUEPRINT.r, BLUEPRINT.g, BLUEPRINT.b);
          if (lp.length / 6 >= maxLinks) break outer;
        }
      }
    }
    return {
      positions, colors, seeds,
      linePositions: new Float32Array(lp),
      lineColors: new Float32Array(lc),
    };
  }, [count]);

  const base = useMemo(() => positions.slice(), [positions]);
  const segCount = linePositions.length / 6;

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Cursor warp with easing and momentum, not 1:1 tracking.
    if (group.current) {
      const tx = mouse.current.y * 0.12;
      const ty = mouse.current.x * 0.18;
      group.current.rotation.x += (tx - group.current.rotation.x) * 0.025;
      group.current.rotation.y += (ty - group.current.rotation.y) * 0.025;
    }

    // Slow drift
    if (points.current) {
      const arr = points.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const s = seeds[i];
        arr[i * 3] = base[i * 3] + Math.sin(t * 0.16 + s) * 0.32;
        arr[i * 3 + 1] = base[i * 3 + 1] + Math.cos(t * 0.13 + s) * 0.32;
      }
      points.current.geometry.attributes.position.needsUpdate = true;
    }

    // Amber pulse travelling along links at irregular intervals
    if (lines.current && segCount > 0) {
      const lc = lines.current.geometry.attributes.color.array as Float32Array;
      const head = (t * 0.09) % 1;
      for (let s = 0; s < segCount; s++) {
        const pos = (s / segCount + Math.sin(s * 12.9898) * 0.5) % 1;
        const d = Math.abs(((pos - head + 1.5) % 1) - 0.5);
        const hot = Math.max(0, 1 - d * 22);
        for (let v = 0; v < 2; v++) {
          const o = s * 6 + v * 3;
          lc[o] = BLUEPRINT.r + (SIGNAL.r - BLUEPRINT.r) * hot;
          lc[o + 1] = BLUEPRINT.g + (SIGNAL.g - BLUEPRINT.g) * hot;
          lc[o + 2] = BLUEPRINT.b + (SIGNAL.b - BLUEPRINT.b) * hot;
        }
      }
      lines.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  const scale = Math.min(1, viewport.width / 14);

  return (
    <group ref={group} scale={scale}>
      <points ref={points}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.075} vertexColors sizeAttenuation transparent opacity={0.95} />
      </points>
      {segCount > 0 && (
        <lineSegments ref={lines}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[lineColors, 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={0.42} />
        </lineSegments>
      )}
    </group>
  );
}

export default function HeroField() {
  const tier = useDeviceTier();
  const count = NODE_COUNT[tier];

  return (
    <Canvas
      aria-hidden
      dpr={[1, 2]}
      gl={{ powerPreference: 'high-performance', antialias: false, alpha: true }}
      camera={{ position: [0, 0, 15], fov: 55 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Depth fog so nodes fade into the dark rather than ending abruptly */}
      <fog attach="fog" args={['#06080D', 12, 30]} />
      <ambientLight intensity={0.6} />
      <pointLight position={[8, 6, 10]} intensity={22} color="#4FD1E0" distance={44} />
      <pointLight position={[-9, -5, 6]} intensity={14} color="#FFB03A" distance={38} />
      <NodeField count={count} />
    </Canvas>
  );
}
