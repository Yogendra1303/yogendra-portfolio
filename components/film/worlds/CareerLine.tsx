"use client";
/**
 * The real worldline: it leaves the wormhole and threads every chapter,
 * growing while the story is told.
 *
 * Concept: up close a career is chaos; from far enough away it is one line.
 * Reference: branching timelines (a sacred line that splinters, the strays
 * pruned), and the colour of a new dimension each time you cross into one.
 * Feeling: turbulence you survive. Every pivot changes the line's colour.
 * At every crisis the present splinters into possible futures that fan out
 * ahead of it, burning orange; as the story resolves, most fold back into
 * the one line and the rest wither. Light riding the line slows down when
 * time dilates. Static (no wobble) under reduced motion; the colours, the
 * branches and the words carry the same information.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { lite } from "@/lib/lite";
import * as THREE from "three";
import { dotTexture } from "@/lib/dot";
import { film } from "@/lib/film";
import { prng } from "@/lib/math";
import { careerCurve } from "@/lib/stage";
import { BRANCHES, careerReveal, MAX_STOPS, STOPS } from "@/lib/timeline";

const vert = /* glsl */ `
  uniform float uReveal; uniform float uTime; uniform float uCrisis;
  varying float vU; varying vec3 vN; varying vec3 vV; varying float vDepth;
  void main() {
    vU = uv.x;
    // The present trembles under crisis.
    float near = exp(-max(uReveal - vU, 0.0) * 90.0);
    vec3 p = position + normal * sin(vU * 1400.0 + uTime * 46.0) * 0.07 * uCrisis * near;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform float uReveal; uniform float uTime; uniform float uCrisis; uniform float uGain; uniform float uSurge; uniform float uFlow;
  uniform float uStopS[${MAX_STOPS}]; uniform vec3 uStopC[${MAX_STOPS}]; uniform int uStops;
  varying float vU; varying vec3 vN; varying vec3 vV; varying float vDepth;
  void main() {
    if (vU > uReveal) discard;
    // A new dimension at every pivot: a hard colour change with a flash at the seam.
    vec3 c = uStopC[0];
    float seam = 0.0;
    for (int i = 1; i < ${MAX_STOPS}; i++) {
      if (i >= uStops) break;
      float s = uStopS[i];
      c = mix(c, uStopC[i], smoothstep(s - 0.0022, s + 0.0022, vU));
      seam += exp(-pow((vU - s) / 0.0016, 2.0));
    }
    float rim = pow(1.0 - abs(dot(vN, vV)), 1.4);
    // Light travels along the line only while you scroll (uFlow is the scroll position).
    float bands = pow(fract(vU * 40.0 - uFlow), 14.0);
    float head = exp(-(uReveal - vU) * 260.0) * (3.0 + uCrisis * 1.2);
    // The present is bright; the path behind you settles back into the dark.
    float trail = 0.35 + 0.65 * exp(-(uReveal - vU) * 9.0);
    // Fade where the line passes right by the lens, so it never floods the frame.
    float g = ((0.5 + rim + bands * 1.3) * trail + head + seam * 2.4) * smoothstep(0.6, 6.0, vDepth);
    vec3 col = mix(c, vec3(1.0, 0.97, 0.92), clamp(seam * 0.55 + head * 0.06, 0.0, 1.0));
    // Filaments: surges of light racing along, like a thread being pulled taut.
    g = g * uGain + uSurge * pow(fract(vU * 7.0 - uFlow * 0.4), 38.0) * 2.4 * trail * smoothstep(0.6, 6.0, vDepth);
    gl_FragColor = vec4(col * g * 0.8, clamp(g * 0.8, 0.0, 1.0));
  }
`;

const branchVert = /* glsl */ `
  attribute vec3 aDiv;   // divergence from the main line at amplitude 1
  attribute vec4 aMeta;  // u along branch, seed, crisis, pruned
  attribute vec4 aWin;   // leaves at a, rejoins at b (arc), grows over story s0..s1
  attribute vec3 aCol;
  uniform float uTime; uniform float uCrisis; uniform float uReveal; uniform float uStory; uniform float uCalm;
  varying float vU; varying float vGrow; varying float vA; varying float vSeed; varying float vCri; varying float vWither;
  varying vec3 vCol; varying vec3 vN; varying vec3 vV;
  void main() {
    float u = aMeta.x;
    float pruned = aMeta.w;
    // Near the present, a crisis flings its futures wider.
    float near = exp(-max(uReveal - aWin.x, 0.0) * 28.0);
    float k = 0.84 + 0.16 * sin(uTime * 0.6 + aMeta.y * 6.283) * uCalm + aMeta.z * uCrisis * near * 1.3;
    k *= 1.0 + 0.12 * sin(u * 13.0 + uTime * 1.9 + aMeta.y * 40.0) * uCalm;
    // Once the main line has passed, a branch that rejoined relaxes into it;
    // a pruned one drifts off.
    float settle = smoothstep(aWin.y, aWin.y + 0.05, uReveal);
    k *= mix(1.0, pruned > 0.5 ? 1.2 : 0.5, settle);
    vec3 p = position + aDiv * k;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vU = u;
    vGrow = clamp((uStory - aWin.z) / max(1e-4, aWin.w - aWin.z), 0.0, 1.0);
    float dieP = 1.0 - 0.94 * smoothstep(aWin.y - (aWin.y - aWin.x) * 0.35, aWin.y + 0.015, uReveal);
    vA = (pruned > 0.5 ? dieP : 1.0 - 0.6 * settle) * smoothstep(0.6, 5.0, -mv.z);
    vWither = pruned > 0.5 ? 1.0 - dieP : 0.0;
    vSeed = aMeta.y;
    vCri = aMeta.z;
    vCol = aCol;
    gl_Position = projectionMatrix * mv;
  }
`;
const branchFrag = /* glsl */ `
  uniform float uTime; uniform float uCrisis;
  varying float vU; varying float vGrow; varying float vA; varying float vSeed; varying float vCri; varying float vWither;
  varying vec3 vCol; varying vec3 vN; varying vec3 vV;
  void main() {
    if (vU > vGrow || vA < 0.01) discard;
    float rim = pow(1.0 - abs(dot(vN, vV)), 1.3);
    float tip = exp(-(vGrow - vU) * 24.0) * step(vGrow, 0.995) * 2.6;
    float bands = pow(fract(vU * 9.0 - uTime * 0.7 + vSeed), 10.0);
    // Sparks race along a living timeline; a pruned one withers grey and dims.
    float spark = pow(fract(vU * 14.0 - uTime * 1.4 + vSeed * 5.0), 36.0) * 2.2 * (1.0 - vWither);
    float g = (0.4 + rim * 0.7 + bands * 0.9 + tip + spark) * vA * (1.0 + uCrisis * vCri * 0.4);
    vec3 col = mix(vCol, vec3(1.0, 0.95, 0.85), clamp(tip * 0.25 + spark * 0.2, 0.0, 1.0));
    col = mix(col, vec3(0.42, 0.46, 0.48), vWither);
    gl_FragColor = vec4(col * g * 0.55, clamp(g * 0.55, 0.0, 1.0));
  }
`;

const glintVert = /* glsl */ `
  attribute vec3 aGate;  // threshold, 0 = story gate (split) / 1 = reveal gate (rejoin), seed
  attribute vec3 aCol;
  uniform float uStory; uniform float uReveal; uniform float uTime; uniform float uCrisis;
  varying vec3 vCol; varying float vA;
  void main() {
    float on = aGate.y < 0.5 ? smoothstep(aGate.x, aGate.x + 0.02, uStory) : smoothstep(aGate.x, aGate.x + 0.01, uReveal);
    float pulse = 0.65 + 0.35 * sin(uTime * 3.0 + aGate.z * 30.0);
    vA = on * pulse * (1.0 + uCrisis);
    vCol = aCol;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = (2.2 + uCrisis * 1.5) * on * (40.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const glintFrag = /* glsl */ `
  varying vec3 vCol; varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = (pow(smoothstep(0.5, 0.0, d), 3.0) + exp(-abs(gl_PointCoord.y - 0.5) * 60.0) * smoothstep(0.5, 0.0, abs(gl_PointCoord.x - 0.5)) * 0.6) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(mix(vCol, vec3(1.0), 0.6) * a, a);
  }
`;

/** One merged mesh for every side timeline: a tube around the main line, pushed out in the shader. */
function buildBranches() {
  const SEG = 96;
  const RAD = 6;
  const nB = BRANCHES.length;
  const nV = nB * (SEG + 1) * RAD;
  const pos = new Float32Array(nV * 3);
  const nor = new Float32Array(nV * 3);
  const div = new Float32Array(nV * 3);
  const meta = new Float32Array(nV * 4);
  const win = new Float32Array(nV * 4);
  const col = new Float32Array(nV * 3);
  const idx: number[] = [];
  const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3(), D = new THREE.Vector3(), R = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let v = 0;
  BRANCHES.forEach((br) => {
    const base = v;
    for (let j = 0; j <= SEG; j++) {
      const u = j / SEG;
      const s = Math.min(1, br.a + (br.b - br.a) * u);
      careerCurve.getPointAt(s, P);
      careerCurve.getTangentAt(s, T);
      N.crossVectors(T, up);
      if (N.lengthSq() < 1e-6) N.set(1, 0, 0);
      N.normalize();
      B.crossVectors(T, N).normalize();
      const ph = br.phase + br.twist * u;
      const env = br.pruned ? Math.pow(u * u * (3 - 2 * u), 0.8) : Math.pow(Math.sin(Math.PI * u), 0.85);
      D.copy(N).multiplyScalar(Math.cos(ph)).addScaledVector(B, Math.sin(ph)).multiplyScalar(env * br.amp);
      const rad = 0.03 * (br.pruned ? 1 - 0.55 * u : 1) * (0.45 + 0.55 * Math.min(1, u * 10));
      for (let k = 0; k < RAD; k++) {
        const a = (k / RAD) * Math.PI * 2;
        R.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(B, Math.sin(a));
        pos.set([P.x + R.x * rad, P.y + R.y * rad, P.z + R.z * rad], v * 3);
        nor.set([R.x, R.y, R.z], v * 3);
        div.set([D.x, D.y, D.z], v * 3);
        meta.set([u, br.seed, br.crisis, br.pruned ? 1 : 0], v * 4);
        win.set([br.a, br.b, br.s0, br.s1], v * 4);
        col.set([br.color.r, br.color.g, br.color.b], v * 3);
        v++;
      }
    }
    for (let j = 0; j < SEG; j++)
      for (let k = 0; k < RAD; k++) {
        const a = base + j * RAD + k, b = base + j * RAD + ((k + 1) % RAD);
        const c = a + RAD, d = b + RAD;
        idx.push(a, c, b, b, c, d);
      }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("aDiv", new THREE.BufferAttribute(div, 3));
  g.setAttribute("aMeta", new THREE.BufferAttribute(meta, 4));
  g.setAttribute("aWin", new THREE.BufferAttribute(win, 4));
  g.setAttribute("aCol", new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

/** Where timelines split off (and, for the survivors, where they rejoin). */
function buildGlints() {
  const pos: number[] = [];
  const gate: number[] = [];
  const col: number[] = [];
  const P = new THREE.Vector3();
  BRANCHES.forEach((br, i) => {
    careerCurve.getPointAt(br.a, P);
    pos.push(P.x, P.y, P.z);
    gate.push(br.s0, 0, i * 0.37);
    col.push(br.color.r, br.color.g, br.color.b);
    if (!br.pruned) {
      careerCurve.getPointAt(Math.min(1, br.b), P);
      pos.push(P.x, P.y, P.z);
      gate.push(br.b, 1, i * 0.73);
      col.push(br.color.r, br.color.g, br.color.b);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aGate", new THREE.Float32BufferAttribute(gate, 3));
  g.setAttribute("aCol", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function CareerLine() {
  const geo = useMemo(() => new THREE.TubeGeometry(careerCurve, 1800, 0.05, 8, false), []);
  const branchGeo = useMemo(buildBranches, []);
  const glintGeo = useMemo(buildGlints, []);
  const firstBranch = useMemo(() => Math.min(...BRANCHES.map((b) => b.s0)), []);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const bmat = useRef<THREE.ShaderMaterial>(null);
  const gmat = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const branches = useRef<THREE.Mesh>(null);
  const glints = useRef<THREE.Points>(null);
  const uniforms = useMemo(() => {
    const stops = STOPS.slice(0, MAX_STOPS);
    const S = new Array<number>(MAX_STOPS).fill(2);
    const C = Array.from({ length: MAX_STOPS }, () => new THREE.Color());
    stops.forEach((st, i) => {
      S[i] = st.s;
      C[i].copy(st.color);
    });
    return {
      uReveal: { value: 0 },
      uTime: { value: 0 },
      uCrisis: { value: 0 },
      uStopS: { value: S },
      uStopC: { value: C },
      uStops: { value: stops.length },
      uGain: { value: 1 },
      uSurge: { value: 0 },
      uFlow: { value: 0 },
    };
  }, []);
  // The braid: three thin filaments twisting around the line, sharing its uniforms.
  const braid = useMemo(() => {
    const P = new THREE.Vector3(), T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const M = 3200;
    const turns = careerCurve.getLength() / 3.2;
    return [0, 1, 2].map((i) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= M; k++) {
        const s = k / M;
        careerCurve.getPointAt(s, P);
        careerCurve.getTangentAt(s, T);
        N.crossVectors(T, up).normalize();
        B.crossVectors(T, N).normalize();
        const a = (i / 3) * Math.PI * 2 + s * turns * Math.PI * 2;
        const rad = 0.16 + 0.04 * Math.sin(s * 400 + i);
        pts.push(P.clone().addScaledVector(N, Math.cos(a) * rad).addScaledVector(B, Math.sin(a) * rad));
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6400, 0.011, 4, false);
    });
  }, []);
  const bUniforms = useMemo(() => ({ uTime: { value: 0 }, uCrisis: { value: 0 }, uReveal: { value: 0 }, uStory: { value: 0 }, uCalm: { value: 1 } }), []);
  const gUniforms = useMemo(() => ({ uTime: { value: 0 }, uCrisis: { value: 0 }, uReveal: { value: 0 }, uStory: { value: 0 } }), []);

  // Light particles riding the traced part of the line.
  const N = lite(900);
  const parts = useMemo(() => {
    const r = prng(91);
    const s = new Float32Array(N), sp = new Float32Array(N), off = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      s[i] = r();
      sp[i] = 0.004 + r() * 0.006;
      off.set([(r() - 0.5) * 0.35, (r() - 0.5) * 0.35, (r() - 0.5) * 0.35], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    return { s, sp, off, g };
  }, []);
  const pm = useRef<THREE.PointsMaterial>(null);
  const v = useMemo(() => new THREE.Vector3(), []);
  const lastFlow = useRef({ s: Number.NaN, reveal: Number.NaN, cam: new THREE.Vector3(1e9, 0, 0) });

  useFrame(({ camera }) => {
    const reveal = careerReveal(film.s);
    const on = reveal > 0;
    if (mesh.current) mesh.current.visible = on;
    if (branches.current) branches.current.visible = film.s > firstBranch;
    if (glints.current) glints.current.visible = film.s > firstBranch;
    if (mat.current) {
      mat.current.uniforms.uReveal.value = reveal;
      mat.current.uniforms.uTime.value = film.time;
      mat.current.uniforms.uFlow.value = film.s * 2.5;
      mat.current.uniforms.uCrisis.value = film.reduced ? 0 : film.crisis;
    }
    for (const m of [bmat.current, gmat.current]) {
      if (!m) continue;
      m.uniforms.uTime.value = film.time;
      m.uniforms.uCrisis.value = film.crisis;
      m.uniforms.uReveal.value = reveal;
      m.uniforms.uStory.value = film.s;
      if (m.uniforms.uCalm) m.uniforms.uCalm.value = film.reduced ? 0 : 1;
    }
    if (pm.current) pm.current.opacity = on ? 0.8 : 0;
    if (!on) return;
    // Light flows along the traced line only while you scroll; it holds still when you stop.
    const L = lastFlow.current;
    if (film.s === L.s && reveal === L.reveal && L.cam.distanceToSquared(camera.position) < 0.04) return;
    L.cam.copy(camera.position);
    const ds = Number.isNaN(L.s) ? 0 : film.s - L.s;
    L.s = film.s;
    L.reveal = reveal;
    const P = (parts.g.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    const lo = Math.max(0, reveal - 0.25);
    const span = Math.max(1e-4, reveal - lo);
    for (let i = 0; i < N; i++) {
      const x = parts.s[i] + parts.sp[i] * ds * 6;
      parts.s[i] = lo + ((((x - lo) % span) + span) % span);
      careerCurve.getPointAt(Math.min(1, parts.s[i]), v);
      P[i * 3] = v.x + parts.off[i * 3];
      P[i * 3 + 1] = v.y + parts.off[i * 3 + 1];
      P[i * 3 + 2] = v.z + parts.off[i * 3 + 2];
      // Never right on the lens (where the line starts at the wormhole exit): it would blot the frame.
      const dx = P[i * 3] - camera.position.x, dy = P[i * 3 + 1] - camera.position.y, dz = P[i * 3 + 2] - camera.position.z;
      // Density stays even: a short stretch of line carries only a few lights.
      if (dx * dx + dy * dy + dz * dz < 9 || i > N * (span / 0.25)) P[i * 3 + 1] += 1e4;
    }
    parts.g.getAttribute("position").needsUpdate = true;
  });

  return (
    <group>
      {braid.map((bg, i) => (
        <mesh key={i} geometry={bg} frustumCulled={false}>
          <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={{ ...uniforms, uGain: { value: 0.45 }, uSurge: { value: 1 } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
      <mesh ref={mesh} geometry={geo} frustumCulled={false}>
        <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={branches} geometry={branchGeo} frustumCulled={false}>
        <shaderMaterial ref={bmat} vertexShader={branchVert} fragmentShader={branchFrag} uniforms={bUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <points ref={glints} geometry={glintGeo} frustumCulled={false}>
        <shaderMaterial ref={gmat} vertexShader={glintVert} fragmentShader={glintFrag} uniforms={gUniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={parts.g} frustumCulled={false}>
        <pointsMaterial map={dotTexture()} ref={pm} color="#eafff4" size={0.08} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}
