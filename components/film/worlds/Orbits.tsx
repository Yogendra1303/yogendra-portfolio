"use client";
/**
 * Chapter 05: change of orbit. It opens as a swarm (thousands of individual
 * customers, B2C) and, as you scroll, the swarm collapses into fifteen heavy
 * bodies on stable orbits around a single star (enterprise accounts, B2B).
 * A wide ring of 10,000+ points circles them: the store locations on SLA.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PX, withPx } from "@/lib/px";
import * as THREE from "three";
import { dotTexture } from "@/lib/dot";
import { film } from "@/lib/film";
import { prng } from "@/lib/math";
import { ORBITS } from "@/lib/stage";

const PLANETS = 15;
const SWARM = 4500;
const RING = 10000;

type Planet = { r: number; speed: number; phase: number; tilt: number; size: number };

function planetPos(p: Planet, t: number, out: THREE.Vector3) {
  const a = p.phase + t * p.speed;
  out.set(Math.cos(a) * p.r, Math.sin(a) * p.r * Math.sin(p.tilt), Math.sin(a) * p.r * Math.cos(p.tilt));
  return out;
}

const swarmVert = withPx(/* glsl */ `
  attribute float aSize;
  uniform float uOn;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vA = uOn;
    gl_PointSize = aSize * (70.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`);
const swarmFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.0) * vA;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export function Orbits() {
  const planets = useMemo<Planet[]>(() => {
    const r = prng(15);
    return Array.from({ length: PLANETS }, (_, i) => ({
      r: 3 + i * 0.75 + r() * 0.4,
      speed: 0.5 / Math.pow(1 + i * 0.25, 1.5),
      phase: r() * Math.PI * 2,
      tilt: Math.PI / 2 + (r() - 0.5) * 0.25,
      size: i < 4 ? 0.34 + r() * 0.12 : 0.14 + r() * 0.12,
    }));
  }, []);

  const orbitGeos = useMemo(
    () =>
      planets.map((p) => {
        const pts: THREE.Vector3[] = [];
        const v = new THREE.Vector3();
        for (let i = 0; i <= 160; i++) pts.push(planetPos({ ...p, phase: 0, speed: 1 }, (i / 160) * Math.PI * 2, v).clone());
        return new THREE.BufferGeometry().setFromPoints(pts);
      }),
    [planets],
  );

  const swarm = useMemo(() => {
    const r = prng(4500);
    const home = new Float32Array(SWARM * 3);
    const owner = new Uint16Array(SWARM);
    const jitter = new Float32Array(SWARM * 3);
    const size = new Float32Array(SWARM);
    for (let i = 0; i < SWARM; i++) {
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1), rad = 4 + Math.pow(r(), 0.6) * 16;
      home.set([Math.sin(ph) * Math.cos(th) * rad, Math.cos(ph) * rad * 0.5, Math.sin(ph) * Math.sin(th) * rad], i * 3);
      owner[i] = Math.floor(Math.pow(r(), 1.7) * PLANETS);
      const jr = 0.15 + r() * 0.35;
      jitter.set([(r() - 0.5) * jr, (r() - 0.5) * jr, (r() - 0.5) * jr], i * 3);
      size[i] = 0.5 + r() * 1.0;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(SWARM * 3), 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    return { home, owner, jitter, g };
  }, []);

  const ring = useMemo(() => {
    const r = prng(10000);
    const pos = new Float32Array(RING * 3);
    for (let i = 0; i < RING; i++) {
      const a = r() * Math.PI * 2;
      const rad = 16 + Math.pow(r(), 0.7) * 5;
      pos.set([Math.cos(a) * rad, (r() - 0.5) * 0.25, Math.sin(a) * rad], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);

  const group = useRef<THREE.Group>(null);
  const planetRefs = useRef<THREE.Mesh[]>([]);
  const ringRef = useRef<THREE.Points>(null);
  const ringMat = useRef<THREE.PointsMaterial>(null);
  const swarmMat = useRef<THREE.ShaderMaterial>(null);
  const orbitMats = useRef<(THREE.LineBasicMaterial | null)[]>([]);
  const starMat = useRef<THREE.MeshBasicMaterial>(null);
  const v = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, dt) => {
    const on = film.presence(5);
    if (group.current) group.current.visible = on > 0.001;
    if (on <= 0.001) return;
    const p = film.progressIn(5);
    const collapse = Math.min(1, Math.max(0, (p - 0.05) / 0.4));
    const k = collapse * collapse * (3 - 2 * collapse);
    const t = film.time * 2.6; // a living system, not a diagram

    planets.forEach((pl, i) => {
      const m = planetRefs.current[i];
      if (!m) return;
      planetPos(pl, t, m.position);
      // Bodies gain mass as the customers fall in, and breathe with it.
      m.scale.setScalar((0.2 + k * 1.1) * (1 + 0.06 * Math.sin(t * 1.7 + i)));
    });

    const P = (swarm.g.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < SWARM; i++) {
      const i3 = i * 3;
      // Free-flying individuals wander on their own little loops.
      const w = t * 0.3 + i;
      const hx = swarm.home[i3] + Math.sin(w * 1.3) * 0.8;
      const hy = swarm.home[i3 + 1] + Math.cos(w * 0.9) * 0.5;
      const hz = swarm.home[i3 + 2] + Math.sin(w * 0.7) * 0.8;
      planetPos(planets[swarm.owner[i]], t, v);
      // The gravity flips: the crowd first blooms outward, then each one falls
      // into its account's orbit as the scroll advances.
      const kk = Math.min(1, Math.max(0, k * 1.3 - (i % 7) * 0.04));
      const bloom = 1 + 0.55 * Math.sin(Math.PI * Math.min(1, k * 2.2)) * (1 - kk);
      P[i3] = hx * bloom + (v.x + swarm.jitter[i3] - hx * bloom) * kk;
      P[i3 + 1] = hy * bloom + (v.y + swarm.jitter[i3 + 1] - hy * bloom) * kk;
      P[i3 + 2] = hz * bloom + (v.z + swarm.jitter[i3 + 2] - hz * bloom) * kk;
    }
    swarm.g.getAttribute("position").needsUpdate = true;

    if (swarmMat.current) swarmMat.current.uniforms.uOn.value = on * (1 - k * 0.55);
    if (ringRef.current) ringRef.current.rotation.y += dt * 0.045;
    if (ringMat.current) ringMat.current.opacity = on * (0.15 + k * 0.5);
    orbitMats.current.forEach((m) => m && (m.opacity = on * k * 0.32));
    if (starMat.current) starMat.current.opacity = on;
  });

  return (
    <group position={ORBITS} ref={group} rotation={[0.35, 0, -0.12]}>
      <mesh renderOrder={-1}>
        <sphereGeometry args={[1.1, 48, 48]} />
        <meshBasicMaterial ref={starMat} color={new THREE.Color(1.6, 1.5, 1.8)} transparent toneMapped={false} />
      </mesh>
      {planets.map((pl, i) => (
        <group key={i}>
          <lineLoop geometry={orbitGeos[i]}>
            <lineBasicMaterial ref={(m) => { orbitMats.current[i] = m; }} color="#8fb8ff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
          </lineLoop>
          <mesh ref={(m) => { if (m) planetRefs.current[i] = m; }}>
            <sphereGeometry args={[pl.size, 32, 32]} />
            <meshBasicMaterial color={i < 4 ? new THREE.Color(1.4, 1.6, 2.2) : new THREE.Color(0.7, 0.85, 1.3)} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <points geometry={swarm.g} frustumCulled={false}>
        <shaderMaterial ref={swarmMat} vertexShader={swarmVert} fragmentShader={swarmFrag} uniforms={{ uPx: PX, uOn: { value: 0 }, uColor: { value: new THREE.Color("#a9c8ff") } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points ref={ringRef} geometry={ring}>
        <pointsMaterial map={dotTexture()} ref={ringMat} color="#cfe0ff" size={0.05} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}
