"use client";
/**
 * The loom: the background of the whole film is not empty space but a
 * tangle of other timelines. Thin, dark, curving filaments drift in depth all
 * around the camera; a few are lit green, with sparks running along them.
 * Reference: the murky, root-like tangle of timelines around a keeper of
 * time (original geometry; inspiration only). Feeling: you are one thread
 * among countless others. The box wraps around the camera, so it never ends.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { lite } from "@/lib/lite";
import { OFF } from "@/lib/debug";
import * as THREE from "three";
import { film } from "@/lib/film";
import { prng } from "@/lib/math";

const BOX = 120;
const STRANDS = lite(170);
const SEG = 14;

const vert = /* glsl */ `
  attribute float aT; attribute float aSeed;
  uniform vec3 uCam; uniform float uTime;
  varying float vT; varying float vSeed; varying float vDepth; varying float vEdge;
  void main() {
    vec3 p = position + vec3(sin(uTime * 0.03 + aSeed * 40.0), sin(uTime * 0.025 + aSeed * 23.0), cos(uTime * 0.028 + aSeed * 31.0)) * 3.0;
    p = mod(p - uCam + ${(BOX / 2).toFixed(1)}, ${BOX.toFixed(1)}) - ${(BOX / 2).toFixed(1)} + uCam;
    // Fade out near the wrap boundary, so a strand jumping to the far side is never seen.
    vec3 q = abs(p - uCam);
    vEdge = 1.0 - smoothstep(${(BOX * 0.36).toFixed(1)}, ${(BOX * 0.46).toFixed(1)}, max(q.x, max(q.y, q.z)));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vT = aT; vSeed = aSeed; vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform float uTime; uniform float uOn;
  varying float vT; varying float vSeed; varying float vDepth; varying float vEdge;
  void main() {
    float lit = step(0.9, vSeed);
    float spark = pow(fract(vT * 2.0 - uTime * 0.35 + vSeed * 9.0), 30.0) * lit;
    float fade = smoothstep(4.0, 14.0, vDepth) * (1.0 - smoothstep(40.0, 60.0, vDepth)) * vEdge;
    vec3 dim = vec3(0.1, 0.22, 0.24);
    vec3 green = vec3(0.3, 1.0, 0.6);
    vec3 col = mix(dim, green, lit * 0.8) * (0.1 + lit * 0.22) + green * spark * 1.6;
    float a = (0.1 + lit * 0.2 + spark) * fade * uOn;
    gl_FragColor = vec4(col * fade * uOn, a);
  }
`;

export function Loom() {
  if (OFF.has("loom")) return null;
  const geo = useMemo(() => {
    const r = prng(7777);
    const pos: number[] = [];
    const ts: number[] = [];
    const seeds: number[] = [];
    for (let i = 0; i < STRANDS; i++) {
      // A root-like filament: a gently wandering curve with a fork near its end.
      const p = new THREE.Vector3((r() - 0.5) * BOX, (r() - 0.5) * BOX, (r() - 0.5) * BOX);
      const d = new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.6, r() - 0.5).normalize();
      const len = 8 + r() * 18;
      const seed = r();
      const pts: THREE.Vector3[] = [p.clone()];
      for (let k = 1; k <= SEG; k++) {
        d.add(new THREE.Vector3(r() - 0.5, (r() - 0.5) * 0.5, r() - 0.5).multiplyScalar(0.35)).normalize();
        pts.push(pts[k - 1].clone().addScaledVector(d, len / SEG));
      }
      for (let k = 1; k < pts.length; k++) {
        pos.push(pts[k - 1].x, pts[k - 1].y, pts[k - 1].z, pts[k].x, pts[k].y, pts[k].z);
        ts.push((k - 1) / SEG, k / SEG);
        seeds.push(seed, seed);
      }
      // The fork.
      const at = pts[Math.floor(SEG * 0.6)];
      const fd = d.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.8).multiplyScalar(len * 0.3);
      pos.push(at.x, at.y, at.z, at.x + fd.x, at.y + fd.y, at.z + fd.z);
      ts.push(0.6, 1);
      seeds.push(seed, seed);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(ts, 1));
    g.setAttribute("aSeed", new THREE.Float32BufferAttribute(seeds, 1));
    return g;
  }, []);
  const uniforms = useMemo(() => ({ uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uOn: { value: 1 } }), []);
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ camera }, dt) => {
    const m = mat.current;
    if (!m) return;
    m.uniforms.uCam.value.copy(camera.position);
    m.uniforms.uTime.value += film.reduced ? 0 : dt;
    // Quieter inside the tree and the tesseract, where other light leads.
    m.uniforms.uOn.value = 1 - 0.7 * Math.max(film.presence(7), film.tesseract);
  });
  return (
    <lineSegments geometry={geo} frustumCulled={false}>
      <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}
