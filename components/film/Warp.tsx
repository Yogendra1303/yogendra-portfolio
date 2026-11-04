"use client";
/**
 * Motion language between chapters. Streaks of light stretch with camera
 * speed, and broken fragments of other timelines drift past for parallax.
 * Both live in a box around the camera and wrap, so space never runs out.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { film } from "@/lib/film";
import { prng } from "@/lib/math";

const BOX = 90;

function wrap(v: number, c: number) {
  const h = BOX / 2;
  return ((((v - c + h) % BOX) + BOX) % BOX) - h + c;
}

export function Warp({ count = 900 }) {
  const base = useMemo(() => {
    const r = prng(9);
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) a.set([(r() - 0.5) * BOX, (r() - 0.5) * BOX, (r() - 0.5) * BOX], i * 3);
    return a;
  }, [count]);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    return g;
  }, [count]);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  const prev = useMemo(() => new THREE.Vector3(), []);
  const vel = useMemo(() => new THREE.Vector3(), []);
  const first = useRef(true);
  const white = useMemo(() => new THREE.Color("#e8fff6"), []);

  useFrame(({ camera }, dt) => {
    const c = camera.position;
    if (first.current) {
      prev.copy(c);
      first.current = false;
    }
    vel.subVectors(c, prev).divideScalar(Math.max(dt, 1e-3));
    prev.copy(c);
    const sp = vel.length();
    const len = Math.min(18, sp * 0.12);
    const dir = sp > 1e-3 ? vel.clone().normalize() : new THREE.Vector3(0, 0, -1);
    const P = (geo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < count; i++) {
      const x = wrap(base[i * 3], c.x), y = wrap(base[i * 3 + 1], c.y), z = wrap(base[i * 3 + 2], c.z);
      P[i * 6] = x; P[i * 6 + 1] = y; P[i * 6 + 2] = z;
      P[i * 6 + 3] = x - dir.x * len; P[i * 6 + 4] = y - dir.y * len; P[i * 6 + 5] = z - dir.z * len;
    }
    geo.getAttribute("position").needsUpdate = true;
    if (mat.current) {
      mat.current.opacity = film.reduced ? 0.15 : Math.min(0.9, 0.12 + sp * 0.02);
      // Streaks take on the colour of the dimension the worldline is in.
      mat.current.color.copy(white).lerp(film.tint, 0.45);
    }
  });

  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <lineBasicMaterial ref={mat} color="#d8fff0" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

/** Fragments of other people's timelines: short broken coloured lines. */
export function Fragments({ count = 70 }) {
  const items = useMemo(() => {
    const r = prng(77);
    const cols = ["#ff9b3d", "#ff4d6d", "#4dd8ff", "#9b7bff", "#2bff88"];
    return Array.from({ length: count }, () => {
      const pts: THREE.Vector3[] = [];
      const segs = 6 + Math.floor(r() * 10);
      const len = 2 + r() * 6;
      const d = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.5, r() - 0.5).normalize();
      for (let k = 0; k < segs; k++) {
        const t = (k / (segs - 1)) * len;
        pts.push(new THREE.Vector3(d.x * t, d.y * t + (r() - 0.5) * 0.25, d.z * t));
      }
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: cols[Math.floor(r() * cols.length)], transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      return { line, base: new THREE.Vector3((r() - 0.5) * BOX, (r() - 0.5) * BOX, (r() - 0.5) * BOX), ph: r() * 100, op: 0.1 + r() * 0.25 };
    });
  }, [count]);
  useFrame(({ camera }) => {
    const c = camera.position;
    const stress = Math.max(film.presence(2) * film.progressIn(2), Math.min(1, film.speed * 2));
    for (const f of items) {
      f.line.position.set(wrap(f.base.x, c.x), wrap(f.base.y, c.y), wrap(f.base.z, c.z));
      // keep them out of the camera's face
      if (f.line.position.distanceTo(c) < 6) f.line.position.y += 12;
      const m = f.line.material as THREE.LineBasicMaterial;
      m.opacity = f.op * (0.6 + 0.4 * Math.sin(film.time * (1 + stress * 8) + f.ph)) * (1 + stress);
    }
  });
  return (
    <group>
      {items.map((f, i) => (
        <primitive key={i} object={f.line} />
      ))}
    </group>
  );
}
