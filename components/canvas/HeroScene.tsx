'use client';
import { useMemo, useRef, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import { EffectComposer, Bloom, DepthOfField, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import gsap from 'gsap';
import { pillars, type Pillar } from '@/lib/pillars';
import { useDeviceTier, NODE_COUNT, type Tier } from '@/lib/useDeviceTier';

const BLUEPRINT = new THREE.Color('#1E3A5F');
const CURRENT = new THREE.Color('#4FD1E0');
const SIGNAL = new THREE.Color('#FFB03A');

/* ---------------------------------------------------------------- lens core */
function LensCore({ dimmed }: { dimmed: boolean }) {
  const group = useRef<THREE.Group>(null);
  const iris = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.z = t * 0.06;
      group.current.scale.setScalar(dimmed ? 0.82 : 1 + Math.sin(t * 0.9) * 0.015);
    }
    if (iris.current) iris.current.rotation.z = -t * 0.22;
    if (glow.current) {
      const m = glow.current.material as THREE.MeshBasicMaterial;
      m.opacity = (dimmed ? 0.1 : 0.26) + Math.sin(t * 1.6) * 0.05;
    }
  });

  // Aperture blades around the lens, echoing the intro
  const blades = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);

  return (
    <group ref={group}>
      <mesh ref={glow}>
        <circleGeometry args={[2.3, 48]} />
        <meshBasicMaterial color={SIGNAL} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>

      <mesh>
        <torusGeometry args={[1.25, 0.035, 16, 96]} />
        <meshStandardMaterial color={CURRENT} emissive={CURRENT} emissiveIntensity={1.6} roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh>
        <torusGeometry args={[1.62, 0.014, 12, 96]} />
        <meshStandardMaterial color={BLUEPRINT} emissive={CURRENT} emissiveIntensity={0.5} />
      </mesh>

      <group ref={iris}>
        {blades.map((a, i) => (
          <mesh key={i} rotation={[0, 0, a]} position={[Math.cos(a) * 0.62, Math.sin(a) * 0.62, 0]}>
            <planeGeometry args={[0.62, 0.16]} />
            <meshStandardMaterial
              color="#0C1119" emissive={SIGNAL} emissiveIntensity={0.35}
              side={THREE.DoubleSide} transparent opacity={0.92}
            />
          </mesh>
        ))}
      </group>

      <mesh>
        <circleGeometry args={[0.5, 40]} />
        <meshBasicMaterial color={SIGNAL} transparent opacity={0.85} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------- glass nodes */
function PillarNode({
  pillar, active, dimmed, onFocus,
}: { pillar: Pillar; active: boolean; dimmed: boolean; onFocus: (p: Pillar) => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((s) => {
    if (!mesh.current) return;
    // Tilt toward the pointer when hovered
    const target = hovered ? 0.32 : 0;
    mesh.current.rotation.y += (s.pointer.x * target - mesh.current.rotation.y) * 0.08;
    mesh.current.rotation.x += (-s.pointer.y * target - mesh.current.rotation.x) * 0.08;
    const want = active ? 1.22 : hovered ? 1.12 : 1;
    mesh.current.scale.x += (want - mesh.current.scale.x) * 0.12;
    mesh.current.scale.y = mesh.current.scale.x;
    mesh.current.scale.z = mesh.current.scale.x;
  });

  const over = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.dataset.cursor = 'zoom';
  }, []);
  const out = useCallback(() => {
    setHovered(false);
    delete document.body.dataset.cursor;
  }, []);

  const opacity = dimmed && !active ? 0.16 : 1;

  return (
    <Float speed={1.1} rotationIntensity={0.16} floatIntensity={0.55}>
      <group position={pillar.pos}>
        <mesh
          ref={mesh}
          onPointerOver={over}
          onPointerOut={out}
          onClick={(e) => { e.stopPropagation(); onFocus(pillar); }}
        >
          <boxGeometry args={[1.75, 1.05, 0.045]} />
          <meshPhysicalMaterial
            color="#141B27"
            emissive={hovered || active ? SIGNAL : CURRENT}
            emissiveIntensity={hovered || active ? 0.5 : 0.16}
            transmission={0.55} thickness={0.6} roughness={0.16}
            metalness={0.1} transparent opacity={opacity}
          />
        </mesh>

        {/* Glowing edge */}
        <lineSegments scale={[1.76, 1.06, 0.05]}>
          <edgesGeometry args={[new THREE.BoxGeometry(1, 1, 1)]} />
          <lineBasicMaterial color={hovered || active ? SIGNAL : CURRENT} transparent opacity={opacity * 0.85} />
        </lineSegments>

        <Html center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <div className={`node-hud ${hovered || active ? 'node-hud-on' : ''}`} style={{ opacity }}>
            <span className="node-hud-kicker">{pillar.hud}</span>
            <span className="node-hud-label">{pillar.label}</span>
            {(hovered || active) && <span className="node-hud-blurb">{pillar.blurb}</span>}
          </div>
        </Html>
      </group>
    </Float>
  );
}

/* ------------------------------------------------------------ particle field */
function ParticleField({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const vel = useRef(0);
  const last = useRef({ x: 0, y: 0 });

  const { positions, colors, seeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 6 + Math.random() * 16;
      const a = Math.random() * Math.PI * 2;
      positions[i * 3] = Math.cos(a) * r * (0.6 + Math.random() * 0.7);
      positions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      positions[i * 3 + 2] = -2 - Math.random() * 18;
      seeds[i] = Math.random() * Math.PI * 2;
      const c = Math.random() > 0.86 ? CURRENT : BLUEPRINT;
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    return { positions, colors, seeds };
  }, [count]);

  const base = useMemo(() => positions.slice(), [positions]);

  useFrame((s) => {
    const t = s.clock.elapsedTime;
    // Cursor velocity drives how much the field reacts
    const dx = s.pointer.x - last.current.x;
    const dy = s.pointer.y - last.current.y;
    last.current = { x: s.pointer.x, y: s.pointer.y };
    vel.current += (Math.min(Math.hypot(dx, dy) * 12, 1) - vel.current) * 0.08;

    if (!points.current) return;
    const arr = points.current.geometry.attributes.position.array as Float32Array;
    const k = 0.3 + vel.current * 1.6;
    for (let i = 0; i < count; i++) {
      const sd = seeds[i];
      arr[i * 3] = base[i * 3] + Math.sin(t * 0.2 + sd) * k;
      arr[i * 3 + 1] = base[i * 3 + 1] + Math.cos(t * 0.17 + sd) * k;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    points.current.rotation.z = t * 0.008;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} vertexColors sizeAttenuation transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

/* ---------------------------------------------------------------- grid floor */
function BlueprintGrid() {
  const g = useRef<THREE.GridHelper>(null);
  useFrame((s) => {
    if (g.current) {
      const m = g.current.material as THREE.Material;
      m.opacity = 0.1 + Math.sin(s.clock.elapsedTime * 0.5) * 0.03;
    }
  });
  return (
    <gridHelper
      ref={g} args={[70, 50, '#1E3A5F', '#12243B']}
      position={[0, -5.2, -6]} rotation={[0, 0, 0]}
    />
  );
}

/* --------------------------------------------------------- camera behaviour */
function CameraRig({ focus }: { focus: Pillar | null }) {
  const { camera } = useThree();
  const tween = useRef<gsap.core.Tween | null>(null);
  const home = useRef(new THREE.Vector3(0, 0, 12));

  // Fly in when a node is focused, fly home when cleared.
  useMemo(() => {
    tween.current?.kill();
    const to = focus
      ? { x: focus.pos[0] * 0.62, y: focus.pos[1] * 0.62, z: focus.pos[2] + 5.2 }
      : { x: home.current.x, y: home.current.y, z: home.current.z };
    tween.current = gsap.to(camera.position, {
      ...to, duration: 1.15, ease: 'power3.inOut',
      onUpdate: () => camera.lookAt(0, 0, 0),
    });
  }, [focus, camera]);

  useFrame((s) => {
    if (focus) return;
    // Mouse parallax while idle
    const tx = s.pointer.x * 1.15;
    const ty = s.pointer.y * 0.75;
    camera.position.x += (tx - camera.position.x) * 0.028;
    camera.position.y += (ty - camera.position.y) * 0.028;
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ------------------------------------------------------------------- effects */
function Effects({ tier, focus }: { tier: Tier; focus: Pillar | null }) {
  const ca = useRef<THREE.Vector2>(new THREE.Vector2(0.0004, 0.0004));
  useFrame((s) => {
    // Chromatic aberration tracks pointer movement for a 35mm feel
    const amt = 0.0004 + Math.min(Math.hypot(s.pointer.x, s.pointer.y) * 0.0016, 0.0022);
    ca.current.set(amt, amt);
  });

  // Mobile gets bloom only; DoF is the expensive pass.
  if (tier === 'mobile') {
    return (
      <EffectComposer>
        <Bloom intensity={0.5} luminanceThreshold={0.35} luminanceSmoothing={0.9} mipmapBlur />
        <Vignette eskil={false} offset={0.28} darkness={0.85} />
      </EffectComposer>
    );
  }

  return (
    <EffectComposer>
      <DepthOfField focusDistance={focus ? 0.012 : 0.02} focalLength={0.05} bokehScale={focus ? 5.5 : 3.2} />
      <Bloom intensity={0.72} luminanceThreshold={0.3} luminanceSmoothing={0.9} mipmapBlur />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={ca.current}
        radialModulation={false}
        modulationOffset={0}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.9} />
    </EffectComposer>
  );
}

/* ---------------------------------------------------------------- the scene */
export default function HeroScene({
  onFocusChange,
}: { onFocusChange?: (p: Pillar | null) => void }) {
  const tier = useDeviceTier();
  const [focus, setFocus] = useState<Pillar | null>(null);

  const setAndReport = useCallback((p: Pillar | null) => {
    setFocus(p);
    onFocusChange?.(p);
  }, [onFocusChange]);

  return (
    <Canvas
      aria-hidden
      dpr={[1, tier === 'mobile' ? 1.5 : 2]}
      gl={{ powerPreference: 'high-performance', antialias: false, alpha: true }}
      camera={{ position: [0, 0, 12], fov: 50 }}
      style={{ position: 'absolute', inset: 0 }}
      onPointerMissed={() => setAndReport(null)}
    >
      <fog attach="fog" args={['#06080D', 14, 40]} />
      <ambientLight intensity={0.5} />
      <pointLight position={[7, 5, 9]} intensity={26} color="#4FD1E0" distance={48} />
      <pointLight position={[-8, -4, 6]} intensity={18} color="#FFB03A" distance={44} />

      <CameraRig focus={focus} />
      <LensCore dimmed={!!focus} />
      {pillars.map((p) => (
        <PillarNode
          key={p.id} pillar={p}
          active={focus?.id === p.id}
          dimmed={!!focus}
          onFocus={setAndReport}
        />
      ))}
      <ParticleField count={Math.round(NODE_COUNT[tier] * 0.55)} />
      <BlueprintGrid />
      <Effects tier={tier} focus={focus} />
    </Canvas>
  );
}
