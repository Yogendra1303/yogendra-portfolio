"use client";
/**
 * Chapters 00 to 02. The line you are handed: a green silk thread of light
 * running straight into the distance (one-point perspective, no labels).
 * In chapter 02, scrolling scrubs the event: the thread starts to shake,
 * arcs crawl along it, and the black hole above pulls most of its light away.
 * After that it stays behind as a dim ghost: the road not taken.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { film } from "@/lib/film";
import { prng, tremorOffset } from "@/lib/math";
import { BH_RADIUS, BLACK_HOLE, EXPECTED } from "@/lib/stage";

// The stretch of line that shakes, in world Z.
const Z0 = -30;
const Z1 = -160;

const ease = (x: number) => x * x * (3 - 2 * x);
const c01 = (x: number) => Math.min(1, Math.max(0, x));

/** Shared drivers for this world, scrubbed by chapter 02's scroll. */
function drivers() {
  const p = film.progressIn(2);
  const tremor = ease(c01((p - 0.02) / 0.3)) * (film.reduced ? 0.3 : 1);
  const pull = ease(c01((p - 0.22) / 0.3));
  return { tremor, pull };
}

const vert = /* glsl */ `
  uniform float uTime;
  uniform float uTremor;
  uniform float uSeed;
  varying float vZ;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying float vDepth;
  void main() {
    float s = clamp((position.z - ${Z0.toFixed(1)}) / ${(Z1 - Z0).toFixed(1)}, 0.0, 1.0);
    float env = sin(3.14159265 * s);
    float t = uTime;
    float y = sin(s * 23.0 + t * 31.0) * 0.55 + sin(s * 7.0 - t * 13.0) * 0.35 + sin(s * 61.0 + t * 57.0) * 0.1;
    float x = cos(s * 19.0 - t * 27.0) * 0.5 + sin(s * 5.0 + t * 9.0) * 0.5;
    float own = sin(s * 90.0 + t * 40.0 + uSeed * 17.0) * 0.12;
    vec3 p = position + vec3((x - own) * env * uTremor, (y + own) * env * uTremor, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vZ = position.z;
    vDepth = -mv.z;
    vNormalV = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform float uTime;
  uniform float uTremor;
  uniform float uOpacity;
  uniform float uSeed;
  uniform vec3 uColor;
  varying float vZ;
  varying vec3 vNormalV;
  varying vec3 vViewDir;
  varying float vDepth;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    float rim = pow(1.0 - abs(dot(vNormalV, vViewDir)), 1.5);
    float bands = pow(fract(-vZ * 0.06 - uTime * 0.5 + uSeed), 14.0);
    float fine = pow(fract(-vZ * 0.31 - uTime * 1.6 + uSeed * 3.0), 26.0) * 0.6;
    float flick = 1.0 + uTremor * (hash(floor(uTime * 24.0) + uSeed) - 0.5) * 1.4;
    float glow = (0.4 + rim * 0.9 + bands * 1.5 + fine) * flick;
    // Fade into the far distance so the line reads as endless.
    float far = 1.0 - smoothstep(120.0, 520.0, vDepth);
    vec3 col = mix(uColor, vec3(0.85, 1.0, 0.92), clamp(bands * 0.6, 0.0, 1.0));
    float a = clamp(glow * uOpacity * far, 0.0, 1.0);
    gl_FragColor = vec4(col * glow * uOpacity * far, a);
  }
`;

function buildStrands() {
  const r = prng(101);
  const out: { geo: THREE.TubeGeometry; seed: number; core: boolean }[] = [];
  const count = 7;
  const len = EXPECTED.from.z - EXPECTED.to.z;
  for (let k = 0; k < count; k++) {
    const core = k === 0;
    const phi = (k / count) * Math.PI * 2;
    const radius = core ? 0 : 0.07 + r() * 0.1;
    const pitch = 7 + r() * 6; // world units per twist
    const pts: THREE.Vector3[] = [];
    const n = 900;
    for (let i = 0; i <= n; i++) {
      const z = EXPECTED.from.z - (len * i) / n;
      const a = phi + ((EXPECTED.from.z - z) / pitch) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    out.push({
      geo: new THREE.TubeGeometry(curve, 2400, core ? 0.012 : 0.0045 + r() * 0.004, 6, false),
      seed: r() * 10,
      core,
    });
  }
  return out;
}

function Strands() {
  const strands = useMemo(buildStrands, []);
  const mats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  useFrame(() => {
    const { tremor, pull } = drivers();
    const remaining = 1 - pull * 0.65;
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uTime.value = film.time;
      m.uniforms.uTremor.value = tremor * 0.38;
      m.uniforms.uOpacity.value = (m.userData.core ? 0.85 : 0.5) * remaining;
    }
  });
  return (
    <group>
      {strands.map((s, i) => (
        <mesh key={i} geometry={s.geo} frustumCulled={false}>
          <shaderMaterial
            ref={(m) => {
              mats.current[i] = m;
              if (m) m.userData.core = s.core;
            }}
            vertexShader={vert}
            fragmentShader={frag}
            uniforms={{
              uTime: { value: 0 },
              uTremor: { value: 0 },
              uOpacity: { value: 1 },
              uSeed: { value: s.seed },
              uColor: { value: new THREE.Color("#2bff88") },
            }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Electric arcs that crawl along the shaking stretch. */
function Lightning({ bolts = 5, segments = 30 }) {
  const lines = useMemo(
    () =>
      Array.from({ length: bolts }, () => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segments * 3), 3));
        const m = new THREE.LineBasicMaterial({ color: "#c8ffe2", transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
        return new THREE.Line(g, m);
      }),
    [bolts, segments],
  );
  const rand = useMemo(() => prng(404), []);
  const clock = useRef(0);
  const tmp = useMemo<[number, number]>(() => [0, 0], []);
  useFrame((_, dt) => {
    const { tremor } = drivers();
    clock.current += dt;
    if (clock.current < 0.06) return;
    clock.current = 0;
    for (const line of lines) {
      const mat = line.material as THREE.LineBasicMaterial;
      const on = !film.reduced && rand() < tremor * 0.85;
      mat.opacity = on ? 0.5 + rand() * 0.5 : 0;
      if (!on) continue;
      const s0 = 0.15 + rand() * 0.6;
      const len = 0.04 + rand() * 0.12;
      const pos = line.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < segments; i++) {
        const s = s0 + (i / (segments - 1)) * len;
        tremorOffset(s, film.time, 0.38 * tremor, tmp);
        const jag = (i === 0 || i === segments - 1 ? 0.15 : 1) * 0.5 * tremor;
        pos.setXYZ(i, tmp[1] + (rand() - 0.5) * jag, tmp[0] + (rand() - 0.5) * jag, Z0 + (Z1 - Z0) * s);
      }
      pos.needsUpdate = true;
    }
  });
  return (
    <group>
      {lines.map((l, i) => (
        <primitive key={i} object={l} frustumCulled={false} />
      ))}
    </group>
  );
}

const pVert = /* glsl */ `
  attribute float aSize;
  attribute float aHeat;
  attribute float aAlpha;
  varying float vHeat;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (1.0 + aHeat * 0.8) * (80.0 / -mv.z);
    vHeat = aHeat;
    vAlpha = aAlpha * (1.0 - smoothstep(60.0, 160.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`;
const pFrag = /* glsl */ `
  varying float vHeat;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.0) * vAlpha;
    if (a < 0.01) discard;
    vec3 col = mix(vec3(0.17, 1.0, 0.53), vec3(1.0, 0.92, 0.78), clamp(vHeat, 0.0, 1.0));
    gl_FragColor = vec4(col * a * (1.0 + vHeat * 1.5), a);
  }
`;

const FLOW = 0;
const FALLING = 1;
const G = 210;
const SWIRL = 7;
const DRAG = 0.8;
const PZ0 = 50; // particles live on this stretch of the line
const PZ1 = -200;

/** Light inside the line. 8 in 10 particles can be captured by the black hole. */
function Light({ count = 3200 }) {
  const rand = useMemo(() => prng(2024), []);
  const st = useMemo(() => {
    const z = new Float32Array(count);
    const speed = new Float32Array(count);
    const ang = new Float32Array(count);
    const rad = new Float32Array(count);
    const mode = new Uint8Array(count);
    const cap = new Uint8Array(count);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      z[i] = PZ0 + (PZ1 - PZ0) * rand();
      speed[i] = 5 + rand() * 6;
      ang[i] = rand() * Math.PI * 2;
      rad[i] = Math.pow(rand(), 2) * 0.2;
      cap[i] = i % 10 < 8 ? 1 : 0;
    }
    return { z, speed, ang, rad, mode, cap, vel };
  }, [count, rand]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) size[i] = 0.6 + rand() * 1.4;
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aHeat", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    return g;
  }, [count, rand]);

  const tmp = useMemo<[number, number]>(() => [0, 0], []);
  const n = useMemo(() => new THREE.Vector3(0.12, 1, 0.3).normalize(), []);

  useFrame((_, rawDt) => {
    // Story time: the whole line slows as the well deepens.
    const dt = Math.min(rawDt, 1 / 30) * film.dilation;
    const { tremor, pull } = drivers();
    const P = (geo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const H = (geo.getAttribute("aHeat") as THREE.BufferAttribute).array as Float32Array;
    const AL = (geo.getAttribute("aAlpha") as THREE.BufferAttribute).array as Float32Array;
    const { z, speed, ang, rad, mode, cap, vel } = st;
    const bx = BLACK_HOLE.x, by = BLACK_HOLE.y, bz = BLACK_HOLE.z;
    // Scrolling back before the event returns all light to the line.
    if (pull <= 0.001) mode.fill(FLOW);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      if (mode[i] === FLOW) {
        z[i] -= speed[i] * dt;
        if (z[i] < PZ1) z[i] += PZ0 - PZ1;
        const s = (z[i] - Z0) / (Z1 - Z0);
        if (s > 0 && s < 1) tremorOffset(s, film.time, tremor * 0.38, tmp);
        else tmp[0] = tmp[1] = 0;
        const a = ang[i] + z[i] * 0.9 + film.time * 0.6;
        P[i3] = tmp[1] + Math.cos(a) * rad[i];
        P[i3 + 1] = tmp[0] + Math.sin(a) * rad[i];
        P[i3 + 2] = z[i];
        H[i] = 0;
        AL[i] = 0.75;
        if (pull > 0 && cap[i] && z[i] < bz + 30 && z[i] > bz - 30 && rand() < pull * dt * 3) {
          mode[i] = FALLING;
          vel[i3] = (rand() - 0.5) * 2;
          vel[i3 + 1] = 3 + rand() * 3;
          vel[i3 + 2] = -speed[i];
        }
      } else {
        const rx = bx - P[i3], ry = by - P[i3 + 1], rz = bz - P[i3 + 2];
        const d2 = rx * rx + ry * ry + rz * rz;
        const d = Math.sqrt(d2);
        const inv = 1 / (d2 * d + 0.05);
        let ax = G * rx * inv, ay = G * ry * inv, az = G * rz * inv;
        const sx = (n.y * rz - n.z * ry) / d, sy = (n.z * rx - n.x * rz) / d, sz = (n.x * ry - n.y * rx) / d;
        const sw = SWIRL / (d + 0.5);
        ax += sx * sw; ay += sy * sw; az += sz * sw;
        // Gravitational time dilation, seen from outside: light falling in
        // slows, dims and freezes at the horizon. sqrt(1 - rs/r), softened.
        const local = Math.max(0.05, Math.sqrt(Math.max(0, 1 - (BH_RADIUS * 1.5) / d)));
        const ldt = dt * local;
        const damp = 1 - DRAG * ldt;
        vel[i3] = (vel[i3] + ax * ldt) * damp;
        vel[i3 + 1] = (vel[i3 + 1] + ay * ldt) * damp;
        vel[i3 + 2] = (vel[i3 + 2] + az * ldt) * damp;
        P[i3] += vel[i3] * ldt;
        P[i3 + 1] += vel[i3 + 1] * ldt;
        P[i3 + 2] += vel[i3 + 2] * ldt;
        H[i] = Math.min(1, 6 / (d2 + 1)) * local;
        AL[i] = Math.min(1, d / (BH_RADIUS * 2.5)) * (0.25 + 0.75 * local);
        if (d < BH_RADIUS * 1.1 || d > 60) {
          mode[i] = FLOW;
          z[i] = PZ0 - rand() * 10;
        }
      }
    }
    geo.getAttribute("position").needsUpdate = true;
    geo.getAttribute("aHeat").needsUpdate = true;
    geo.getAttribute("aAlpha").needsUpdate = true;
  });

  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial vertexShader={pVert} fragmentShader={pFrag} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export function ExpectedPath() {
  return (
    <group>
      <Strands />
      <Lightning />
      <Light />
    </group>
  );
}
