"use client";
/** Chapter 08: a single bright point far ahead. However far you travel, it stays ahead. */
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { film } from "@/lib/film";
import { DESTINATION } from "@/lib/stage";

const vert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const frag = /* glsl */ `
  uniform float uOn; uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);
    float core = exp(-r * 60.0) * 3.0;
    float halo = exp(-r * 9.0) * 0.5;
    // anamorphic streak
    float streak = exp(-abs(p.y) * 260.0) * exp(-abs(p.x) * 3.5) * 1.2;
    float spikes = exp(-abs(p.x) * 220.0) * exp(-abs(p.y) * 10.0) * 0.4;
    float tw = 0.9 + 0.1 * sin(uTime * 3.0);
    float a = (core + halo + streak + spikes) * uOn * tw;
    vec3 col = mix(vec3(0.75, 1.0, 0.88), vec3(1.0), clamp(core, 0.0, 1.0));
    gl_FragColor = vec4(col * a, clamp(a, 0.0, 1.0));
  }
`;

export function Destination() {
  const mesh = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ camera }) => {
    const rest = 1 - 0.85 * Math.min(1, Math.max(0, (film.rawIn(8) - 0.76) / 0.1));
    const on = Math.max(film.presence(8) * rest, film.presence(7) * 0.4, film.presence(0) * 0.6);
    if (mesh.current) {
      mesh.current.quaternion.copy(camera.quaternion);
      mesh.current.visible = on > 0.001;
    }
    if (mat.current) {
      mat.current.uniforms.uOn.value = on;
      mat.current.uniforms.uTime.value = film.time;
    }
  });
  return (
    <mesh ref={mesh} position={DESTINATION} scale={260}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={{ uOn: { value: 0 }, uTime: { value: 0 } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  );
}
