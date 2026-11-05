"use client";
/**
 * Chapters 00 to 02. The line you are handed, seen first person: it starts
 * under the viewer and is drawn ahead of the camera only as you scroll (a
 * bright head, the trail behind it dimming). Stop scrolling and it holds
 * still: no flicker, no idle motion. It bends around the school's crystal
 * into the centre of that frame, then comes in from the left and spirals
 * into the black hole along its disk, reddening as it falls. After the
 * horizon it is gone: the plan did not survive the pull.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { lite } from "@/lib/lite";
import { PX, withPx } from "@/lib/px";
import * as THREE from "three";
import { film, HORIZON_U } from "@/lib/film";
import { prng } from "@/lib/math";
import { sections } from "@/lib/plan";
import { HANDED } from "@/lib/stage";

const ease = (x: number) => x * x * (3 - 2 * x);
const c01 = (x: number) => Math.min(1, Math.max(0, x));
const M = HANDED.mark;

/** How far the line has been drawn (arc-length fraction), from the story's scroll position. */
function headAt() {
  const s = film.s;
  if (s < 1) return M.ahead + (M.cube - M.ahead) * ease(c01(s));
  if (s < 2) {
    const f = s - 1;
    const h = sections[1]?.holdEnd ?? 0.6;
    return f < h ? M.cube + (M.centre - M.cube) * ease(f / h) : M.centre + (M.fall - M.centre) * ease((f - h) / (1 - h));
  }
  if (s < 3) return M.fall + (1 - M.fall) * ease(c01((film.progressIn(2) - 0.06) / 0.46));
  return 1;
}
/** Phase of the light pulses: pinned to scroll, so light only travels while you scroll. */
const flow = () => film.s * 8;

const vert = /* glsl */ `
  varying float vU; varying vec3 vN; varying vec3 vV; varying float vDepth;
  void main() {
    vU = uv.x;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform float uHead; uniform float uFlow; uniform float uOpacity; uniform float uSeed; uniform float uFall;
  uniform vec3 uColor;
  varying float vU; varying vec3 vN; varying vec3 vV; varying float vDepth;
  void main() {
    float behind = uHead - vU;
    if (behind < 0.0) discard;
    float rim = pow(1.0 - abs(dot(vN, vV)), 1.5);
    float bands = pow(fract(vU * 60.0 - uFlow + uSeed), 14.0);
    float head = exp(-behind * 140.0);
    float trail = 0.3 + 0.7 * exp(-behind * 7.0);
    float g = (0.35 + rim * 0.8 + bands * 1.2) * trail + head * 3.0;
    // Never floods the lens where it passes under you; fades into the distance.
    g *= smoothstep(0.8, 5.0, vDepth) * (1.0 - smoothstep(140.0, 420.0, vDepth));
    // The fall: light reddens and dims as it reaches the horizon.
    float fall = smoothstep(uFall, 1.0, vU);
    vec3 col = mix(uColor, vec3(1.0, 0.62, 0.3), fall * 0.8);
    col = mix(col, vec3(0.9, 1.0, 0.94), clamp(bands * 0.5 + head * 0.4, 0.0, 1.0));
    g *= 1.0 - 0.8 * smoothstep(0.93, 1.0, vU);
    gl_FragColor = vec4(col * g * uOpacity, clamp(g * uOpacity, 0.0, 1.0));
  }
`;

function buildStrands() {
  const r = prng(101);
  const curve = HANDED.curve;
  const out: { geo: THREE.TubeGeometry; seed: number; core: boolean }[] = [];
  out.push({ geo: new THREE.TubeGeometry(curve, 1800, 0.014, 6, false), seed: 0, core: true });
  // Three fine strands twisting around the core, closing in as they fall.
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const S = 2000;
  const turns = curve.getLength() / 9;
  for (let k = 0; k < 3; k++) {
    const pts: THREE.Vector3[] = [];
    const radius = 0.07 + r() * 0.06;
    for (let i = 0; i <= S; i++) {
      const s = i / S;
      curve.getPointAt(s, P);
      curve.getTangentAt(s, T);
      N.crossVectors(T, up).normalize();
      B.crossVectors(T, N).normalize();
      const a = (k / 3) * Math.PI * 2 + s * turns * Math.PI * 2;
      const rad = radius * (1 - 0.8 * Math.max(0, (s - M.fall) / (1 - M.fall)));
      pts.push(P.clone().addScaledVector(N, Math.cos(a) * rad).addScaledVector(B, Math.sin(a) * rad));
    }
    out.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 2400, 0.0045 + r() * 0.003, 4, false), seed: r() * 10, core: false });
  }
  return out;
}

function Strands() {
  const strands = useMemo(buildStrands, []);
  const mats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  useFrame(() => {
    const head = headAt();
    for (const m of mats.current) {
      if (!m) continue;
      m.uniforms.uHead.value = head;
      m.uniforms.uFlow.value = flow();
      // Brighter at the hole, where the camera stands back from it.
      m.uniforms.uOpacity.value = (m.userData.core ? 0.9 : 0.55) * (1 + 0.6 * film.presence(2));
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
              uHead: { value: 0 },
              uFlow: { value: 0 },
              uFall: { value: M.fall },
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

const pVert = withPx(/* glsl */ `
  attribute float aSize;
  attribute float aHeat;
  attribute float aAlpha;
  varying float vHeat;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (1.0 + aHeat * 0.8) * (80.0 / -mv.z);
    vHeat = aHeat;
    vAlpha = aAlpha * smoothstep(1.2, 5.0, -mv.z) * (1.0 - smoothstep(80.0, 200.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }
`);
const pFrag = /* glsl */ `
  varying float vHeat;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.0) * vAlpha;
    if (a < 0.01) discard;
    vec3 col = mix(vec3(0.17, 1.0, 0.53), vec3(1.0, 0.78, 0.5), clamp(vHeat, 0.0, 1.0));
    gl_FragColor = vec4(col * a * (1.0 + vHeat * 1.5), a);
  }
`;

const LUT = 2048;

/** Light inside the line. It rides toward the head only while you scroll, and falls in with it. */
function Light({ count = lite(1400) }) {
  const st = useMemo(() => {
    const rand = prng(2024);
    const u = new Float32Array(count);
    const rate = new Float32Array(count);
    const off = new Float32Array(count * 3);
    const size = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      u[i] = rand();
      rate[i] = 0.05 + rand() * 0.06;
      const k = Math.pow(rand(), 2) * 0.16;
      off.set([(rand() - 0.5) * k, (rand() - 0.5) * k, (rand() - 0.5) * k], i * 3);
      size[i] = 0.6 + rand() * 1.4;
    }
    const lut = HANDED.curve.getSpacedPoints(LUT);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aHeat", new THREE.BufferAttribute(new Float32Array(count), 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(new Float32Array(count), 1));
    return { u, rate, off, lut, g };
  }, [count]);
  const last = useRef({ s: Number.NaN, head: Number.NaN });

  useFrame(() => {
    const head = headAt();
    const L = last.current;
    // Nothing moves unless the scroll does.
    if (film.s === L.s && head === L.head) return;
    const ds = Number.isNaN(L.s) ? 0 : film.s - L.s;
    L.s = film.s;
    L.head = head;
    const { u, rate, off, lut, g } = st;
    const lo = Math.max(0, head - 0.4);
    const span = Math.max(1e-4, head - lo);
    const P = (g.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const H = (g.getAttribute("aHeat") as THREE.BufferAttribute).array as Float32Array;
    const AL = (g.getAttribute("aAlpha") as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < count; i++) {
      let x = u[i] + ds * rate[i];
      x = lo + ((((x - lo) % span) + span) % span);
      u[i] = x;
      const t = x * LUT;
      const j = Math.min(LUT - 1, Math.floor(t));
      const f = t - j;
      const a = lut[j], b = lut[j + 1];
      const heat = c01((x - M.fall) / (1 - M.fall));
      const k = 1 - 0.85 * heat;
      const i3 = i * 3;
      P[i3] = a.x + (b.x - a.x) * f + off[i3] * k;
      P[i3 + 1] = a.y + (b.y - a.y) * f + off[i3 + 1] * k;
      P[i3 + 2] = a.z + (b.z - a.z) * f + off[i3 + 2] * k;
      H[i] = heat * heat;
      AL[i] = 0.75 * (1 - c01((x - 0.93) / 0.07)) * (0.45 + 0.55 * Math.exp(-(head - x) * 7));
    }
    g.getAttribute("position").needsUpdate = true;
    g.getAttribute("aHeat").needsUpdate = true;
    g.getAttribute("aAlpha").needsUpdate = true;
  });

  return (
    <points geometry={st.g} frustumCulled={false}>
      <shaderMaterial vertexShader={pVert} fragmentShader={pFrag} uniforms={{ uPx: PX }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

export function ExpectedPath() {
  const g = useRef<THREE.Group>(null);
  // Gone once the camera has crossed the horizon: it all fell in.
  useFrame(() => {
    if (g.current) g.current.visible = film.u < HORIZON_U;
  });
  return (
    <group ref={g}>
      <Strands />
      <Light />
    </group>
  );
}
