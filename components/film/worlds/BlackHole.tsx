"use client";
/**
 * Chapter 02's anomaly, ray-marched. Each pixel's light ray is bent toward
 * the singularity as it travels; rays that fall in are black, rays that
 * cross the tilted accretion disk pick up its glow (brighter on the side
 * rotating toward you), and near-misses light up the photon ring. That is
 * why you see the disk's far side lensed over the top and under the bottom.
 * Scroll opens it. The camera later falls toward the horizon and cuts to black.
 *
 * The sky behind it is bent by lib/lens.ts with the same mass, so the stars
 * and the nebula wrap into an Einstein ring around this shadow. Time runs
 * slow here (film.time dilates), so the disk turns heavier as you fall.
 */
import { useMemo, useRef } from "react";
import { createPortal, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { film, HORIZON_U } from "@/lib/film";
import { BH_BOUNDS, BH_RADIUS, BLACK_HOLE } from "@/lib/stage";

const vert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const frag = /* glsl */ `
  uniform vec3 uCenter;
  uniform float uRs;
  uniform float uBounds;
  uniform float uTime;
  uniform vec3 uN;
  uniform float uOpen;
  varying vec3 vWorld;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    if (uOpen < 0.002) discard;
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - ro);
    vec3 oc = ro - uCenter;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - uBounds * uBounds;
    float h = b * b - c;
    if (h < 0.0) discard;
    float tEnter = -b - sqrt(h);
    vec3 p = c < 0.0 ? oc : oc + rd * max(tEnter, 0.0);
    vec3 dir = rd;

    float rs = uRs * uOpen;
    vec3 n = uN;
    vec3 e1 = normalize(cross(n, vec3(0.0, 0.0, 1.0)));
    vec3 e2 = cross(n, e1);
    float rin = rs * 2.3;
    float rout = rs * 8.5;

    vec3 col = vec3(0.0);
    float alpha = 0.0;
    float minR = 1e5;
    bool captured = false;
    float prevSide = dot(p, n);

    for (int i = 0; i < 170; i++) {
      float r = length(p);
      minR = min(minR, r);
      if (r < rs) { captured = true; break; }
      if (r > uBounds * 1.02 && dot(p, dir) > 0.0) break;
      float stepLen = clamp(0.05 * r, 0.015, 0.6);
      vec3 pn = p + dir * stepLen;
      float side = dot(pn, n);
      if (side * prevSide < 0.0) {
        vec3 q = mix(p, pn, prevSide / (prevSide - side));
        float rq = length(q);
        if (rq > rin && rq < rout) {
          float k = (rq - rin) / (rout - rin);
          float ang = atan(dot(q, e2), dot(q, e1));
          float spin = uTime * (3.0 / (0.4 + k * 3.0));
          float gas = noise(vec2(ang * 4.0 + spin, rq * 2.2)) * 0.6 + noise(vec2(ang * 13.0 + spin * 1.6, rq * 7.0)) * 0.4;
          vec3 vdir = normalize(cross(n, q));
          float dop = clamp(1.0 + 0.75 * dot(vdir, -dir), 0.25, 2.0);
          float inten = pow(1.0 - k, 1.6) * (0.35 + gas) * dop * dop * 1.6;
          float edge = smoothstep(0.0, 0.06, k) * smoothstep(1.0, 0.7, k);
          vec3 hot = vec3(1.0, 0.96, 0.88);
          vec3 amber = vec3(1.0, 0.55, 0.18);
          vec3 ember = vec3(0.55, 0.12, 0.04);
          vec3 dc = mix(hot, amber, smoothstep(0.0, 0.4, k));
          dc = mix(dc, ember, smoothstep(0.45, 1.0, k));
          float a = clamp(inten * edge, 0.0, 1.0);
          col += dc * inten * edge * (1.0 - alpha);
          alpha += a * (1.0 - alpha);
        }
      }
      prevSide = side;
      dir = normalize(dir - (p / r) * (1.25 * rs / (r * r)) * stepLen);
      p = pn;
      if (alpha > 0.985) break;
    }

    if (captured) {
      alpha = 1.0; // the shadow: no light comes back
    } else {
      float ring = exp(-pow((minR - rs * 1.55) / (rs * 0.22), 2.0));
      // Light that orbited the hole before escaping: a razor-thin inner ring.
      float ring2 = exp(-pow((minR - rs * 1.34) / (rs * 0.045), 2.0));
      ring = max(ring, ring2 * 1.25);
      vec3 rc = mix(vec3(1.0, 0.85, 0.65), vec3(1.0, 0.97, 0.92), ring2) * ring * 1.5;
      col += rc * (1.0 - alpha);
      alpha = max(alpha, ring * 0.9);
      // soft lensing glow around the whole thing
      float glow = exp(-max(minR - rs, 0.0) / (rs * 2.5)) * 0.18;
      col += vec3(1.0, 0.7, 0.4) * glow * (1.0 - alpha);
      alpha = max(alpha, glow * 0.5);
    }
    col *= uOpen;
    alpha *= min(1.0, uOpen * 1.5);
    gl_FragColor = vec4(col, alpha);
  }
`;

/** Full-frame composite of the half-resolution hole (premultiplied alpha). */
const compVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const compFrag = /* glsl */ `
  uniform sampler2D uTex;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(uTex, vUv); }
`;

export function BlackHole() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uCenter: { value: BLACK_HOLE.clone() },
      uRs: { value: BH_RADIUS },
      uBounds: { value: BH_BOUNDS },
      uTime: { value: 0 },
      uN: { value: new THREE.Vector3(0.12, 1, 0.3).normalize() },
      uOpen: { value: 0 },
    }),
    [],
  );
  // Ray-marched into a half-resolution buffer and scaled up over the frame:
  // the hole is smooth, so a quarter of the pixels look the same and cost a
  // quarter as much (it was the heaviest pass in the film when it fills the screen).
  const scene = useMemo(() => new THREE.Scene(), []);
  const rt = useMemo(() => new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, depthBuffer: false }), []);
  const quad = useRef<THREE.Mesh>(null);
  const clear = useMemo(() => new THREE.Color(), []);
  useFrame(({ gl, camera, size }) => {
    if (!mat.current || !mesh.current || !quad.current) return;
    const open = film.bhOpen;
    const on = open > 0.001 && film.u < HORIZON_U;
    mesh.current.visible = on;
    quad.current.visible = on;
    mat.current.uniforms.uOpen.value = open;
    mat.current.uniforms.uTime.value = film.time;
    if (!on) return;
    // Half resolution while it holds; lower still in the fall, where it fills
    // the frame and the motion hides the difference.
    const k = film.u > 2.01 ? 0.36 : 0.5;
    const w = Math.max(2, Math.round(size.width * gl.getPixelRatio() * k));
    const h = Math.max(2, Math.round(size.height * gl.getPixelRatio() * k));
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    const prev = gl.getRenderTarget();
    gl.getClearColor(clear);
    const alpha = gl.getClearAlpha();
    gl.setRenderTarget(rt);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(scene, camera);
    gl.setRenderTarget(prev);
    gl.setClearColor(clear, alpha);
  });
  return (
    <>
      {createPortal(
        <mesh ref={mesh} position={BLACK_HOLE} frustumCulled={false}>
          <sphereGeometry args={[BH_BOUNDS, 48, 32]} />
          <shaderMaterial
            ref={mat}
            vertexShader={vert}
            fragmentShader={frag}
            uniforms={uniforms}
            side={THREE.BackSide}
            transparent
            premultipliedAlpha
            depthWrite={false}
            depthTest={false}
          />
        </mesh>,
        scene,
      )}
      <mesh ref={quad} renderOrder={5} frustumCulled={false}>
        <planeGeometry args={[2, 2]} />
        <shaderMaterial
          vertexShader={compVert}
          fragmentShader={compFrag}
          uniforms={{ uTex: { value: rt.texture } }}
          transparent
          premultipliedAlpha
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
