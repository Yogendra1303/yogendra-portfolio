"use client";
/**
 * Chapter 07: every line at once. A true 4D hypercube, rotated in the XW and
 * YW planes and projected into 3D, so it folds through itself. Woven through
 * it, one looping thread per chapter colour: all the timelines visible
 * together, which is the only way the shape of the whole makes sense.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { dotTexture } from "@/lib/dot";
import { chapters } from "@/content/story";
import { film } from "@/lib/film";
import { TESSERACT } from "@/lib/stage";

const VERTS: number[][] = [];
for (let i = 0; i < 16; i++) VERTS.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
const EDGES: [number, number][] = [];
for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (i < j) EDGES.push([i, j]); }

export function Tesseract() {
  const group = useRef<THREE.Group>(null);
  const lineGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(EDGES.length * 6), 3));
    return g;
  }, []);
  const vertGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(16 * 3), 3));
    return g;
  }, []);
  const threads = useMemo(() => {
    const cols = chapters.slice(1, 7).map((c) => c.color);
    return cols.map((c, k) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 300; i++) {
        const t = (i / 300) * Math.PI * 2;
        // Lissajous knots: each thread a different frequency pairing.
        pts.push(new THREE.Vector3(Math.sin(t * (2 + (k % 3)) + k) * 4.2, Math.sin(t * (3 + (k % 2)) + k * 0.7) * 3.2, Math.cos(t * (1 + (k % 4))) * 4.2));
      }
      return { geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 600, 0.025, 6, true), color: c };
    });
  }, []);
  const lm = useRef<THREE.LineBasicMaterial>(null);
  const vm = useRef<THREE.PointsMaterial>(null);
  const tm = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const p4 = useMemo(() => new Float32Array(16 * 3), []);

  useFrame((_, dt) => {
    const on = film.presence(7) + film.presence(8) * 0.35;
    if (group.current) {
      group.current.visible = on > 0.001;
      group.current.rotation.y += dt * 0.05;
    }
    if (on <= 0.001) return;
    // Turns on wall-clock time: story time stops in here, the fourth dimension doesn't.
    const a = film.clock * 0.35, b = film.clock * 0.23;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const S = 3.2;
    for (let i = 0; i < 16; i++) {
      let [x, y, z, w] = VERTS[i];
      // rotate XW then YW
      [x, w] = [x * ca - w * sa, x * sa + w * ca];
      [y, w] = [y * cb - w * sb, y * sb + w * cb];
      const k = 2.6 / (3.2 - w);
      p4[i * 3] = x * k * S;
      p4[i * 3 + 1] = y * k * S;
      p4[i * 3 + 2] = z * k * S;
    }
    const L = (lineGeo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    EDGES.forEach(([i, j], e) => {
      L.set([p4[i * 3], p4[i * 3 + 1], p4[i * 3 + 2], p4[j * 3], p4[j * 3 + 1], p4[j * 3 + 2]], e * 6);
    });
    lineGeo.getAttribute("position").needsUpdate = true;
    (vertGeo.getAttribute("position") as THREE.BufferAttribute).set(p4);
    vertGeo.getAttribute("position").needsUpdate = true;
    if (lm.current) lm.current.opacity = 0.7 * on;
    if (vm.current) vm.current.opacity = on;
    const reveal = Math.min(1, film.progressIn(7) / 0.35);
    tm.current.forEach((m, k) => m && (m.opacity = on * 0.85 * Math.min(1, Math.max(0, reveal * 6 - k))));
  });

  return (
    <group position={TESSERACT} ref={group}>
      <lineSegments geometry={lineGeo} frustumCulled={false}>
        <lineBasicMaterial ref={lm} color="#e8fff4" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points geometry={vertGeo} frustumCulled={false}>
        <pointsMaterial map={dotTexture()} ref={vm} color="#ffffff" size={0.22} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {threads.map((t, k) => (
        <mesh key={k} geometry={t.geo}>
          <meshBasicMaterial ref={(m) => { tm.current[k] = m; }} color={t.color} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
