"use client";
/**
 * Chapter 01: initial conditions. Science as order: an atom with clean
 * elliptical orbits inside a perfect crystal lattice. Cold, precise,
 * predictable. Everything here behaves, which is the point.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { dotTexture } from "@/lib/dot";
import { film } from "@/lib/film";
import { SCIENCE } from "@/lib/stage";

const ORBITS = [
  { rx: 3.2, ry: 1.0, rot: [0.3, 0, 0.2], speed: 1.1 },
  { rx: 3.2, ry: 1.0, rot: [-0.4, 0.9, -0.5], speed: 0.9 },
  { rx: 3.2, ry: 1.0, rot: [1.1, -0.6, 0.8], speed: 1.3 },
  { rx: 4.6, ry: 1.6, rot: [0.2, 1.7, -0.2], speed: 0.6 },
] as const;

function Lattice() {
  const { points, lines } = useMemo(() => {
    const n = 7;
    const s = 1.35;
    const pts: number[] = [];
    const seg: number[] = [];
    const o = ((n - 1) * s) / 2;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        for (let k = 0; k < n; k++) {
          const x = i * s - o, y = j * s - o, z = k * s - o;
          pts.push(x, y, z);
          if (i < n - 1) seg.push(x, y, z, x + s, y, z);
          if (j < n - 1) seg.push(x, y, z, x, y + s, z);
          if (k < n - 1) seg.push(x, y, z, x, y, z + s);
        }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return { points: pg, lines: lg };
  }, []);
  const pm = useRef<THREE.PointsMaterial>(null);
  const lm = useRef<THREE.LineBasicMaterial>(null);
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const k = film.presence(1);
    if (pm.current) pm.current.opacity = 0.55 * k;
    if (lm.current) lm.current.opacity = 0.06 * k;
    if (g.current) g.current.rotation.y += dt * 0.02;
  });
  return (
    <group ref={g}>
      <points geometry={points}>
        <pointsMaterial map={dotTexture()} ref={pm} color="#cfe6ff" size={0.06} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <lineSegments geometry={lines}>
        <lineBasicMaterial ref={lm} color="#9fd4ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}

function Atom() {
  const electrons = useRef<THREE.Mesh[]>([]);
  const rings = useMemo(
    () =>
      ORBITS.map((o) => {
        const curve = new THREE.EllipseCurve(0, 0, o.rx, o.ry, 0, Math.PI * 2, false, 0);
        const pts = curve.getPoints(160).map((p) => new THREE.Vector3(p.x, p.y, 0));
        return new THREE.BufferGeometry().setFromPoints(pts);
      }),
    [],
  );
  const mats = useRef<(THREE.LineBasicMaterial | null)[]>([]);
  const core = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const k = Math.max(film.presence(1), film.presence(0) * 0.2);
    ORBITS.forEach((o, i) => {
      const e = electrons.current[i];
      if (!e) return;
      const a = film.time * o.speed + i * 1.7;
      e.position.set(Math.cos(a) * o.rx, Math.sin(a) * o.ry, 0);
    });
    mats.current.forEach((m) => m && (m.opacity = 0.35 * k));
    if (core.current) core.current.opacity = k;
  });
  return (
    <group scale={0.9}>
      <mesh>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshBasicMaterial ref={core} color="#e8f4ff" transparent toneMapped={false} />
      </mesh>
      {ORBITS.map((o, i) => (
        <group key={i} rotation={o.rot as unknown as THREE.Euler}>
          <lineLoop geometry={rings[i]}>
            <lineBasicMaterial ref={(m) => { mats.current[i] = m; }} color="#9fd4ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </lineLoop>
          <mesh ref={(m) => { if (m) electrons.current[i] = m; }}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Science() {
  return (
    <group position={SCIENCE}>
      <Lattice />
      <Atom />
    </group>
  );
}
