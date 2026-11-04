"use client";
/**
 * Concept: the universe the career moves through. Deep, quiet, enormous.
 * Reference: the infinite black of deep-space cinema; stars as hard points,
 * nebulae as faint breath, and between them nothing at all.
 * Feeling: scale and awe before anything moves.
 *
 * Everything here is starlight, so everything here is lensed (lib/lens.ts):
 * near a mass the stars slide into arcs, line up into an Einstein ring and
 * brighten. Stars and galaxies are bent per point (with the second, flipped
 * image inside the ring); the nebula and the fine dust are bent per pixel.
 */
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { prng } from "@/lib/math";
import { film } from "@/lib/film";
import { LENSES, lensGLSL, lensUniforms } from "@/lib/lens";

const lensActive = () => lensUniforms.uLensE.value.some((v) => v > 0);

/** World position of a point after lensing. Shared by stars and galaxies. */
const lensedPosition = /* glsl */ `
  ${lensGLSL}
  uniform float uImage;
  vec4 lensedView(vec3 local, out float mu) {
    vec3 wp = (modelMatrix * vec4(local, 1.0)).xyz;
    vec3 rel = wp - cameraPosition;
    float dist = length(rel);
    vec3 s = lensForward(rel / dist, uImage, mu);
    return viewMatrix * vec4(cameraPosition + s * dist, 1.0);
  }
`;

const starVert = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vTwinkle;
  ${lensedPosition}
  void main() {
    float mu;
    vec4 mv = lensedView(position, mu);
    vTwinkle = (0.86 + 0.14 * sin(uTime * (0.5 + aPhase) + aPhase * 40.0)) * min(mu, 5.0);
    vColor = aColor;
    gl_PointSize = aSize * (300.0 / -mv.z) * sqrt(clamp(mu, 0.0, 6.0));
    gl_Position = projectionMatrix * mv;
  }
`;
const starFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    // A hard core and a faint skirt: points of light, not blobs.
    float core = smoothstep(0.5, 0.0, d);
    float a = (pow(core, 3.4) + pow(core, 12.0) * 1.5) * vTwinkle;
    if (a < 0.008) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

function Stars({ count = 9000 }) {
  const mats = useRef<(THREE.ShaderMaterial | null)[]>([]);
  const second = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const r = prng(7);
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const palette = [new THREE.Color("#ffffff"), new THREE.Color("#cfe0ff"), new THREE.Color("#ffe6c4"), new THREE.Color("#aac4ff"), new THREE.Color("#ffd2a1")];
    for (let i = 0; i < count; i++) {
      const u = r() * 2 - 1;
      const th = r() * Math.PI * 2;
      const rad = 70 + r() * 140;
      const s = Math.sqrt(1 - u * u);
      pos.set([rad * s * Math.cos(th), rad * u, rad * s * Math.sin(th)], i * 3);
      // Most stars are faint pinpricks; a rare few are bright. That is the contrast.
      const b = Math.pow(r(), 9);
      size[i] = 0.32 + b * 4.2;
      phase[i] = r();
      const c = palette[Math.floor(r() * palette.length)];
      const dim = 0.55 + 0.45 * Math.min(1, b * 6 + 0.2);
      col.set([c.r * dim, c.g * dim, c.b * dim], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    return g;
  }, [count]);

  const uniforms = useMemo(
    () => [1, -1].map((img) => ({ uTime: { value: 0 }, uImage: { value: img }, ...lensUniforms })),
    [],
  );

  useFrame((_, dt) => {
    for (const m of mats.current) if (m) m.uniforms.uTime.value += dt;
    // The second (flipped) image only exists while something is bending light.
    if (second.current) second.current.visible = lensActive();
  });

  return (
    <>
      {uniforms.map((u, k) => (
        <points key={k} ref={k === 1 ? second : undefined} geometry={geo} frustumCulled={false}>
          <shaderMaterial
            ref={(m) => {
              mats.current[k] = m;
            }}
            vertexShader={starVert}
            fragmentShader={starFrag}
            uniforms={u}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </points>
      ))}
    </>
  );
}

const galaxyVert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  varying vec3 vColor;
  ${lensedPosition}
  void main() {
    float mu;
    vec4 mv = lensedView(position, mu);
    gl_PointSize = aSize * (220.0 / -mv.z) * sqrt(clamp(mu, 0.0, 6.0));
    vColor = aColor * min(mu, 4.0);
    gl_Position = projectionMatrix * mv;
  }
`;
const galaxyFrag = /* glsl */ `
  varying vec3 vColor;
  uniform float uOpacity;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 3.0) * uOpacity;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

type GalaxyProps = {
  seed: number;
  position: [number, number, number];
  rotation: [number, number, number];
  radius: number;
  branches: number;
  inside: string;
  outside: string;
  count?: number;
  speed?: number;
};

/** Logarithmic-ish spiral galaxy: arms, spin, and a dense bright core. */
function Galaxy({ seed, position, rotation, radius, branches, inside, outside, count = 14000, speed = 0.02 }: GalaxyProps) {
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const r = prng(seed);
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const cin = new THREE.Color(inside);
    const cout = new THREE.Color(outside);
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const rad = Math.pow(r(), 1.6) * radius;
      const branch = ((i % branches) / branches) * Math.PI * 2;
      const spin = rad * 1.1;
      const rp = 2.6;
      const spread = 0.35 * rad + 0.15;
      const rx = Math.pow(r(), rp) * (r() < 0.5 ? 1 : -1) * spread;
      const ry = Math.pow(r(), rp) * (r() < 0.5 ? 1 : -1) * spread * 0.35;
      const rz = Math.pow(r(), rp) * (r() < 0.5 ? 1 : -1) * spread;
      pos.set([Math.cos(branch + spin) * rad + rx, ry, Math.sin(branch + spin) * rad + rz], i * 3);
      tmp.copy(cin).lerp(cout, Math.min(1, rad / radius));
      col.set([tmp.r, tmp.g, tmp.b], i * 3);
      size[i] = 0.5 + r() * 1.5 + (rad < radius * 0.12 ? 2 : 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return g;
  }, [seed, count, radius, branches, inside, outside]);
  const uniforms = useMemo(() => ({ uOpacity: { value: 0.36 }, uImage: { value: 1 }, ...lensUniforms }), []);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });

  return (
    <group position={position} rotation={rotation}>
      <points ref={ref} geometry={geo} frustumCulled={false}>
        <shaderMaterial vertexShader={galaxyVert} fragmentShader={galaxyFrag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}

/** Noise for the nebula, shared by the bake and the dust. */
const noiseGLSL = /* glsl */ `
  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
`;

/**
 * The nebula itself, painted once into a cube map at startup (it is far too
 * slow to change on screen anyway). Deeper void: clouds are rarer and
 * fainter, with a little more body where they are.
 */
const bakeFrag = /* glsl */ `
  varying vec3 vDir;
  ${noiseGLSL}
  float fbm(vec3 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
  void main() {
    vec3 d = normalize(vDir);
    float n = fbm(d * 2.4);
    float m = fbm(d * 5.0);
    vec3 violet = vec3(0.16, 0.05, 0.28);
    vec3 teal = vec3(0.0, 0.16, 0.14);
    vec3 col = mix(violet, teal, smoothstep(0.35, 0.75, m)) * pow(smoothstep(0.47, 0.98, n), 2.1) * 1.15;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const nebulaFrag = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;
  uniform float uTremor;
  uniform samplerCube uNebula;
  ${lensGLSL}
  ${noiseGLSL}

  // Fine star dust: one star per cell on the sky sphere, most cells empty.
  // Because it is drawn per pixel, lensing stretches it into arcs.
  vec3 dust(vec3 d, float scale, float density) {
    vec3 p = d * scale;
    vec3 i = floor(p);
    float h = hash(i + 0.37);
    if (h > density) return vec3(0.0);
    vec3 c = vec3(hash(i + 1.3), hash(i + 2.7), hash(i + 4.1)) * 0.6 + 0.2;
    vec3 q = fract(p) - c;
    float r2 = dot(q, q);
    float b = pow(hash(i + 7.7), 6.0) * 0.9 + 0.12;
    vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.86, 0.7), hash(i + 9.1));
    return tint * b * exp(-r2 * 260.0);
  }

  void main() {
    vec3 d0 = normalize(vDir);
    vec3 d = lensInverse(d0);
    vec3 col = textureCube(uNebula, d).rgb * (0.5 + uTremor * 0.3);
    col += dust(d, 260.0, 0.11) * 0.5 + dust(d, 120.0, 0.05) * 0.7;
    // Unseen masses: background light smeared into broken arcs on the
    // Einstein ring, and a darker core where the mass sits.
    for (int i = 0; i < ${LENSES}; i++) {
      float te = uLensE[i];
      if (te <= 0.0 || uLensC[i] <= 0.0) continue;
      vec3 m = uLensDir[i];
      float th = acos(clamp(dot(d0, m), -1.0, 1.0));
      vec3 e1 = normalize(cross(m, vec3(0.0, 1.0, 0.0001)));
      vec3 e2 = cross(m, e1);
      float ang = atan(dot(d0, e2), dot(d0, e1));
      float arcs = smoothstep(0.42, 0.85, noise(vec3(cos(ang) * 1.7, sin(ang) * 1.7, float(i) * 7.0 + uTime * 0.03)));
      float ring = exp(-pow((th - te) / (te * 0.05), 2.0)) * (0.15 + 0.85 * arcs);
      col += vec3(1.0, 0.74, 0.46) * ring * 0.14;
      col += vec3(1.0, 0.82, 0.58) * exp(-pow(th / (te * 0.3), 2.0)) * 0.22;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;
const nebulaVert = /* glsl */ `
  varying vec3 vDir;
  void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

function Nebula() {
  const gl = useThree((s) => s.gl);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const target = useMemo(() => new THREE.WebGLCubeRenderTarget(512, { type: THREE.HalfFloatType, generateMipmaps: false }), []);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uTremor: { value: 0 }, uNebula: { value: target.texture }, ...lensUniforms }), [target]);
  // Paint the nebula into the cube map once.
  useLayoutEffect(() => {
    const scene = new THREE.Scene();
    const geo = new THREE.SphereGeometry(10, 64, 32);
    const m = new THREE.ShaderMaterial({ vertexShader: nebulaVert, fragmentShader: bakeFrag, side: THREE.BackSide, depthWrite: false });
    scene.add(new THREE.Mesh(geo, m));
    const cam = new THREE.CubeCamera(0.1, 100, target);
    const prev = { tone: gl.toneMapping, clear: gl.autoClear };
    gl.toneMapping = THREE.NoToneMapping;
    gl.autoClear = true;
    cam.update(gl, scene);
    gl.toneMapping = prev.tone;
    gl.autoClear = prev.clear;
    geo.dispose();
    m.dispose();
  }, [gl, target]);
  useEffect(() => () => target.dispose(), [target]);
  useFrame((_, dt) => {
    if (!mat.current) return;
    mat.current.uniforms.uTime.value += dt;
    mat.current.uniforms.uTremor.value = Math.min(1, film.speed * 2);
  });
  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[400, 48, 32]} />
      <shaderMaterial ref={mat} vertexShader={nebulaVert} fragmentShader={nebulaFrag} uniforms={uniforms} side={THREE.BackSide} depthWrite={false} />
    </mesh>
  );
}

/** The far universe. It travels with the camera, so it reads as infinitely distant. */
export function Backdrop() {
  const g = useRef<THREE.Group>(null);
  useFrame(({ camera }) => {
    if (g.current) g.current.position.copy(camera.position);
  });
  return (
    <group ref={g}>
      <Nebula />
      <Stars />
      <Galaxy seed={11} position={[-46, 20, -110]} rotation={[0.9, 0.2, 0.3]} radius={11} branches={4} inside="#ffd9a8" outside="#5a6bff" />
      <Galaxy seed={23} position={[58, -24, -140]} rotation={[1.25, -0.4, -0.2]} radius={14} branches={3} inside="#e8fff0" outside="#2bd38a" count={16000} speed={0.012} />
      <Galaxy seed={37} position={[22, 34, -160]} rotation={[0.4, 0.8, 0.9]} radius={8} branches={5} inside="#ffffff" outside="#b05cff" count={9000} speed={0.03} />
    </group>
  );
}
