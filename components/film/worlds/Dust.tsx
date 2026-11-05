"use client";
/**
 * Volumetric cosmic dust, everywhere the camera goes.
 * Concept: space is not empty; it is full of slow, lit matter that tells you
 * how fast you are moving and where the light is. Reference: the drifting
 * motes in a sunbeam, scaled up to a solar system.
 * - Slow drift that never repeats; a box of dust wraps around the camera.
 * - Light bleed: dust between you and the world's light scatters it forward
 *   and glows warm.
 * - Depth: motes close to the lens are big, soft and dim (out of focus);
 *   far ones are sharp points.
 * - Turbulence: in a crisis the dust churns faster, and every debris hit
 *   throws it forward in a burst.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { lite } from "@/lib/lite";
import { PX, withPx } from "@/lib/px";
import * as THREE from "three";
import { film } from "@/lib/film";
import { prng } from "@/lib/math";

const BOX = 46;
const COUNT = lite(2600);

const vert = withPx(/* glsl */ `
  attribute vec3 aSeed;
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uChurn;
  uniform vec3 uLight;
  uniform float uLightOn;
  uniform float uGold;
  varying float vA;
  varying float vWarm;
  void main() {
    // Wrap the dust box around the camera so it never runs out.
    vec3 drift = vec3(sin(uTime * 0.05 + aSeed.x * 6.3), sin(uTime * 0.04 + aSeed.y * 6.3), cos(uTime * 0.045 + aSeed.z * 6.3)) * (1.5 + uChurn * 6.0);
    vec3 p = position + drift;
    p = mod(p - uCam + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam;
    vec3 q = abs(p - uCam);
    float edge = 1.0 - smoothstep(${(BOX * 0.36).toFixed(1)}, ${(BOX * 0.47).toFixed(1)}, max(q.x, max(q.y, q.z)));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    vec3 toDust = normalize(p - cameraPosition);
    vec3 toLight = normalize(uLight - cameraPosition);
    float fwd = pow(max(0.0, dot(toDust, toLight)), 18.0) * uLightOn;
    float focus = smoothstep(1.0, 9.0, depth);
    vWarm = max(fwd, uGold * step(0.72, aSeed.y));
    vA = (0.06 + fwd * 1.6 + uGold * step(0.72, aSeed.y) * 0.5) * (1.0 - smoothstep(16.0, 23.0, depth)) * (0.35 + 0.65 * focus) * smoothstep(0.4, 1.4, depth) * edge;
    gl_PointSize = (2.0 + (1.0 - focus) * 9.0) * (0.6 + aSeed.x) * (60.0 / max(depth, 0.5)) * 0.12;
    gl_Position = projectionMatrix * mv;
  }
`);
const frag = /* glsl */ `
  varying float vA;
  varying float vWarm;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, d) * vA;
    if (a < 0.004) discard;
    vec3 col = mix(vec3(0.62, 0.72, 0.85), vec3(1.0, 0.82, 0.6), clamp(vWarm, 0.0, 1.0));
    gl_FragColor = vec4(col * a, a);
  }
`;

export function Dust() {
  const geo = useMemo(() => {
    const r = prng(808);
    const pos = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      pos.set([(r() - 0.5) * BOX, (r() - 0.5) * BOX, (r() - 0.5) * BOX], i * 3);
      seed.set([r(), r(), r()], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(seed, 3));
    return g;
  }, []);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uChurn: { value: 0 },
      uLight: { value: new THREE.Vector3() },
      uLightOn: { value: 0 },
      uGold: { value: 0 },
    }),
    [],
  );
  useFrame(({ camera }, dt) => {
    if (!mat.current) return;
    const u = mat.current.uniforms;
    u.uCam.value.copy(camera.position);
    // Churn speeds the dust up in turbulence; the clock runs on story time plus a kick on every hit.
    const kick = film.reduced ? 0 : Math.exp(-film.hit * 3) * 6;
    u.uTime.value += (film.dt + dt * film.crisis * 2) * (1 + kick);
    u.uChurn.value = film.reduced ? 0 : film.crisis;
    u.uLight.value.copy(film.light);
    u.uLightOn.value = Math.min(1, film.lightOn * 2);
    u.uGold.value = film.reduced ? 0 : film.crisis;
  });
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={{ ...uniforms, uPx: PX }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}
