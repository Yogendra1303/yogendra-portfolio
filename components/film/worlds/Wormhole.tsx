"use client";
/**
 * The transit between chapter 02 and 03: having fallen through the horizon,
 * the camera rides a tunnel of streaking light and comes out somewhere else
 * entirely. Built along the camera's own route so it always surrounds you.
 * It opens out of the black inside the hole, never before.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { film, HORIZON_U } from "@/lib/film";
import { cameraCurve, WORMHOLE_T } from "@/lib/stage";

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const frag = /* glsl */ `
  uniform float uTime;
  uniform float uOn;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  void main() {
    float along = vUv.x;
    float around = vUv.y;
    float streak = noise(vec2(around * 64.0, along * 18.0 - uTime * 6.0));
    streak = pow(streak, 6.0) * 3.0;
    float rings = pow(0.5 + 0.5 * sin(along * 260.0 - uTime * 30.0), 18.0) * 0.5;
    vec3 a = vec3(0.17, 1.0, 0.53);
    vec3 b = vec3(1.0, 0.6, 0.25);
    vec3 c = vec3(0.45, 0.55, 1.0);
    vec3 col = mix(a, b, smoothstep(0.1, 0.5, along));
    col = mix(col, c, smoothstep(0.5, 0.9, along));
    float ends = smoothstep(0.0, 0.12, along) * smoothstep(1.0, 0.85, along);
    float inten = (streak + rings + 0.06) * ends * uOn;
    gl_FragColor = vec4(col * inten, clamp(inten, 0.0, 1.0));
  }
`;

export function Wormhole() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const mesh = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const [t0, t1] = WORMHOLE_T;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 60; i++) pts.push(cameraCurve.getPoint(t0 + ((t1 - t0) * i) / 60));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 2.6, 48, false);
  }, []);
  useFrame(() => {
    if (!mat.current || !mesh.current) return;
    const u = film.u;
    const exit = Math.min(1, Math.max(0, (u - 2.6) / 0.26));
    const open = Math.min(1, Math.max(0, (u - HORIZON_U) / 0.17));
    const on = 0.62 * open * open * (3 - 2 * open) * (1 - exit * exit * (3 - 2 * exit));
    mat.current.uniforms.uOn.value = on;
    mat.current.uniforms.uTime.value = film.time;
    mesh.current.visible = on > 0.001;
  });
  return (
    <mesh ref={mesh} geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={mat}
        vertexShader={vert}
        fragmentShader={frag}
        uniforms={{ uTime: { value: 0 }, uOn: { value: 0 } }}
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
