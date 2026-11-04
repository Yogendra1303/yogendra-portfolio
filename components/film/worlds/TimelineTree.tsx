"use client";
/**
 * Chapter 07, The Synthesis: the tree of timelines.
 * Concept: every thread of the career, chaotic up close, is gathered in from
 * the dark, bound into one trunk, and grows into a single living tree.
 * Reference: a keeper of time gathering the broken timelines in his hands and
 * weaving them into a world tree (original geometry and code; inspiration only).
 * Feeling: release. The chaos had a shape all along.
 * - Hundreds of thin, curved strands converge from every direction (roots).
 * - They twist into a trunk, then branch, and branch again, into a crown.
 * - Light runs up the strands; a few burn brighter; gold embers at the tips.
 * - It grows with the scroll through the chapter; static under reduced motion.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { film } from "@/lib/film";
import { prng } from "@/lib/math";
import { TESSERACT } from "@/lib/stage";

const vert = /* glsl */ `
  attribute float aT;     // 0 far root .. 1 crown tip, along the strand
  attribute float aSeed;
  uniform float uGrow;
  varying float vT; varying float vSeed; varying float vOn;
  void main() {
    vT = aT; vSeed = aSeed;
    vOn = step(aT, uGrow);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const frag = /* glsl */ `
  uniform float uTime; uniform float uOn; uniform float uGrow;
  varying float vT; varying float vSeed; varying float vOn;
  void main() {
    if (vOn < 0.5) discard;
    // Light climbing the strands, faster near the trunk; a few strands burn bright.
    float pulse = pow(fract(vT * 4.0 - uTime * 0.45 + vSeed * 7.0), 14.0);
    float bright = step(0.8, vSeed);
    float head = exp(-(uGrow - vT) * 40.0) * 2.0;
    // Dim, root-like strands far out; they brighten as they gather into the trunk and crown.
    float base = 0.35 + 1.1 * smoothstep(0.3, 0.6, vT);
    vec3 green = mix(vec3(0.08, 0.7, 0.42), vec3(0.5, 1.0, 0.68), smoothstep(0.3, 0.9, vT));
    // Each timeline starts dark, burnt orange, out in the chaos, and turns green as it comes home.
    green = mix(vec3(0.55, 0.22, 0.06), green, smoothstep(0.08, 0.36, vT));
    vec3 col = mix(green, vec3(1.0, 0.9, 0.55), head * 0.3);
    float a = (base + pulse * 2.4 + bright * 1.2 + head) * uOn;
    gl_FragColor = vec4(col * a, a);
  }
`;
/** The hero timelines: nine thick strands, one per chapter of the arc. */
const heroVert = /* glsl */ `
  varying float vT;
  void main() { vT = uv.x * 0.62; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const heroFrag = /* glsl */ `
  uniform float uTime; uniform float uOn; uniform float uGrow;
  varying float vT;
  void main() {
    if (vT > uGrow) discard;
    // From black and burnt orange out in the chaos to living green at the centre.
    vec3 c = mix(vec3(0.08, 0.03, 0.01), vec3(0.85, 0.35, 0.08), smoothstep(0.0, 0.12, vT));
    c = mix(c, vec3(0.35, 1.0, 0.6), smoothstep(0.14, 0.4, vT));
    float surge = pow(fract(vT * 3.0 - uTime * 0.6), 20.0) * 2.0;
    float head = exp(-(uGrow - vT) * 30.0) * 2.0;
    float a = (0.9 + surge + head) * uOn;
    gl_FragColor = vec4(c * a, clamp(a, 0.0, 1.0));
  }
`;

const emberVert = /* glsl */ `
  attribute float aT; attribute float aSeed;
  uniform float uGrow; uniform float uTime; uniform float uOn;
  varying float vA;
  void main() {
    vec3 p = position + vec3(sin(uTime * 0.4 + aSeed * 30.0), sin(uTime * 0.3 + aSeed * 17.0) + uTime * 0.0, cos(uTime * 0.35 + aSeed * 11.0)) * 0.35;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vA = step(aT, uGrow) * uOn * (0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 40.0));
    gl_PointSize = (2.0 + aSeed * 3.0) * (40.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const emberFrag = /* glsl */ `
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(1.0, 0.78, 0.38) * a, a);
  }
`;

function buildTree() {
  const r = prng(1985);
  const pos: number[] = [];
  const ts: number[] = [];
  const seeds: number[] = [];
  const ember: number[] = [];
  const emberT: number[] = [];
  const emberSeed: number[] = [];
  const v = new THREE.Vector3();
  const pushCurve = (curve: THREE.Curve<THREE.Vector3>, t0: number, t1: number, seed: number, n: number) => {
    let prev = curve.getPoint(0);
    for (let k = 1; k <= n; k++) {
      const p = curve.getPoint(k / n);
      pos.push(prev.x, prev.y, prev.z, p.x, p.y, p.z);
      ts.push(t0 + ((k - 1) / n) * (t1 - t0), t0 + (k / n) * (t1 - t0));
      seeds.push(seed, seed);
      prev = p;
    }
  };
  const BASE = new THREE.Vector3(0, -7, 0);
  const TOP = new THREE.Vector3(0, 2.5, 0);
  // Roots: strands gathered in from the dark, from every direction.
  const ROOTS = 150;
  for (let i = 0; i < ROOTS; i++) {
    const th = r() * Math.PI * 2;
    const ph = Math.acos(r() * 1.6 - 1); // mostly below and around
    const rad = 28 + r() * 30;
    const far = new THREE.Vector3(Math.sin(ph) * Math.cos(th) * rad, Math.cos(ph) * rad * 0.6 - 6, Math.sin(ph) * Math.sin(th) * rad);
    const ctrl = far.clone().multiplyScalar(0.35).add(new THREE.Vector3((r() - 0.5) * 8, -6 - r() * 6, (r() - 0.5) * 8));
    const seed = r();
    pushCurve(new THREE.QuadraticBezierCurve3(far, ctrl, BASE.clone().add(new THREE.Vector3((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8))), 0, 0.4, seed, 18);
    // The trunk: every strand twists up through it.
    const a0 = r() * Math.PI * 2;
    const tr = 0.35 + r() * 0.7;
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 12; k++) {
      const y = BASE.y + ((TOP.y - BASE.y) * k) / 12;
      const a = a0 + k * 0.45;
      const w = tr * (1 - 0.35 * Math.sin((Math.PI * k) / 12));
      pts.push(new THREE.Vector3(Math.cos(a) * w, y, Math.sin(a) * w));
    }
    pushCurve(new THREE.CatmullRomCurve3(pts), 0.4, 0.58, seed, 12);
  }
  // Crown: the trunk branches, and branches again, into one living tree.
  const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, depth: number, t0: number) => {
    const t1 = t0 + 0.42 / 4;
    const bend = new THREE.Vector3((r() - 0.5) * 0.6, 0.25, (r() - 0.5) * 0.6);
    const to = from.clone().addScaledVector(dir, len);
    const ctrl = from.clone().addScaledVector(dir, len * 0.5).addScaledVector(bend, len * 0.4);
    const seed = r();
    // Several strands per branch, slightly apart: a bundle, not a stick.
    const strands = Math.max(1, 5 - depth);
    for (let s = 0; s < strands; s++) {
      const off = new THREE.Vector3((r() - 0.5), (r() - 0.5), (r() - 0.5)).multiplyScalar(0.18 * (4 - depth));
      pushCurve(new THREE.QuadraticBezierCurve3(from.clone().add(off), ctrl.clone().add(off), to.clone().add(off.multiplyScalar(0.5))), t0, t1, (seed + s * 0.13) % 1, 10);
    }
    if (depth >= 3) {
      v.copy(to);
      ember.push(v.x, v.y, v.z);
      emberT.push(t1);
      emberSeed.push(r());
      return;
    }
    const kids = depth === 0 ? 5 : 3;
    for (let k = 0; k < kids; k++) {
      const a = (k / kids) * Math.PI * 2 + r() * 0.8;
      const out = new THREE.Vector3(Math.cos(a), 0.55 + r() * 0.5 - depth * 0.12, Math.sin(a)).normalize();
      const d = dir.clone().multiplyScalar(0.45).add(out).normalize();
      branch(to, d, len * (0.62 + r() * 0.12), depth + 1, t1);
    }
  };
  branch(TOP, new THREE.Vector3(0, 1, 0), 3.4, 0, 0.58);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aT", new THREE.Float32BufferAttribute(ts, 1));
  g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
  const e = new THREE.BufferGeometry();
  e.setAttribute("position", new THREE.Float32BufferAttribute(ember, 3));
  e.setAttribute("aT", new THREE.Float32BufferAttribute(emberT, 1));
  e.setAttribute("aSeed", new THREE.Float32BufferAttribute(emberSeed, 1));
  return { g, e };
}

function buildHeroes() {
  const r = prng(909);
  const BASE = new THREE.Vector3(0, -7, 0);
  return Array.from({ length: 9 }, (_, i) => {
    // From the edges of the frame (wide, low, and out to the sides), into one point, then up the trunk.
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const far = new THREE.Vector3(Math.cos(a) * 34, -14 + Math.sin(a * 2) * 9 + r() * 4, Math.sin(a) * 30);
    const mid = far.clone().multiplyScalar(0.4).add(new THREE.Vector3(0, -3, 0));
    const pts = [far, mid, BASE.clone().add(new THREE.Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3))];
    for (let k = 1; k <= 6; k++) pts.push(new THREE.Vector3(Math.cos(a + k * 0.5) * 0.45, BASE.y + k * 1.6, Math.sin(a + k * 0.5) * 0.45));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.05, 6, false);
  });
}

export function TimelineTree() {
  const { g, e } = useMemo(buildTree, []);
  const heroes = useMemo(buildHeroes, []);
  const heroMat = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const group = useRef<THREE.Group>(null);
  const lineMat = useRef<THREE.ShaderMaterial>(null);
  const emberMat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uGrow: { value: 0 }, uOn: { value: 0 } }), []);
  useFrame((_, dt) => {
    const on = Math.max(film.presence(7), film.presence(8) * 0.25);
    if (group.current) {
      group.current.visible = on > 0.002;
      group.current.rotation.y += dt * 0.04;
    }
    if (on <= 0.002) return;
    // It grows with the chapter: roots gather, the trunk binds, the crown opens.
    const p = film.section > 7 ? 1 : film.section < 7 ? 0 : film.progressIn(7);
    uniforms.uGrow.value = film.reduced ? 1 : Math.min(1, p / 0.5);
    uniforms.uOn.value = on;
    uniforms.uTime.value += dt; // wall clock: time has stopped here, light has not
    // Write through the materials themselves (they may hold their own uniform objects).
    for (const m of [lineMat.current, emberMat.current, ...heroMat.current]) {
      if (!m) continue;
      m.uniforms.uGrow.value = uniforms.uGrow.value;
      m.uniforms.uOn.value = uniforms.uOn.value;
      m.uniforms.uTime.value = uniforms.uTime.value;
    }
  });
  return (
    <group ref={group} position={[TESSERACT.x, TESSERACT.y + 3.5, TESSERACT.z]} scale={0.85}>
      <lineSegments geometry={g} frustumCulled={false}>
        <shaderMaterial ref={lineMat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      {heroes.map((hg, k) => (
        <mesh key={k} geometry={hg} frustumCulled={false}>
          <shaderMaterial ref={(m) => { heroMat.current[k] = m; }} vertexShader={heroVert} fragmentShader={heroFrag} uniforms={{ uTime: { value: 0 }, uGrow: { value: 0 }, uOn: { value: 0 } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      <points geometry={e} frustumCulled={false}>
        <shaderMaterial ref={emberMat} vertexShader={emberVert} fragmentShader={emberFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}
