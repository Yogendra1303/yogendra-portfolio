"use client";
/**
 * A holographic Earth built from real coastline data (Natural Earth, 110m),
 * sampled into evenly spaced dots. Cities sit at their real coordinates and
 * journeys are drawn as great-circle arcs that trace themselves as you scroll.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { PX, withPx } from "@/lib/px";
import * as THREE from "three";
import dots from "@/content/earth-dots.json";
import { film } from "@/lib/film";
import { cameraCurve, keyT } from "@/lib/stage";

type City = { lat: number; lon: number; name: string };
export type Arc = { from: City; to: City; start: number; end: number; color: string };

const D2R = Math.PI / 180;
export function latLon(lat: number, lon: number, r: number, out = new THREE.Vector3()) {
  const la = lat * D2R, lo = lon * D2R;
  return out.set(Math.cos(la) * Math.sin(lo) * r, Math.sin(la) * r, Math.cos(la) * Math.cos(lo) * r);
}

const dotVert = withPx(/* glsl */ `
  uniform float uOn;
  varying float vFace;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 nv = normalize(normalMatrix * normalize(position));
    vFace = dot(nv, normalize(-mv.xyz));
    gl_PointSize = (1.6 + 1.2 * max(vFace, 0.0)) * (60.0 / -mv.z) * uOn;
    gl_Position = projectionMatrix * mv;
  }
`);
const dotFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOn;
  varying float vFace;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.15, d) * (0.12 + 0.88 * smoothstep(-0.2, 0.6, vFace)) * uOn;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * a * 0.62, a);
  }
`;

const atmoVert = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const atmoFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uOn;
  varying vec3 vN; varying vec3 vV;
  void main() {
    float f = pow(1.0 - abs(dot(vN, vV)), 3.0);
    gl_FragColor = vec4(uColor * f * 0.8 * uOn, f * uOn * 0.8);
  }
`;

const arcVert = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() { vT = aT; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const arcFrag = /* glsl */ `
  uniform float uDraw; uniform vec3 uColor; uniform float uOn; uniform float uTime;
  varying float vT;
  void main() {
    if (vT > uDraw) discard;
    float head = exp(-(uDraw - vT) * 40.0) * 2.5;
    float pulse = pow(fract(vT * 3.0 - uTime * 0.6), 12.0);
    float a = (0.9 + head * 1.5 + pulse) * uOn * 1.6;
    gl_FragColor = vec4(uColor * a, clamp(a, 0.0, 1.0));
  }
`;

function ArcLine({ arc, radius, chapter }: { arc: Arc; radius: number; chapter: number }) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const geo = useMemo(() => {
    const a = latLon(arc.from.lat, arc.from.lon, 1).normalize();
    const b = latLon(arc.to.lat, arc.to.lon, 1).normalize();
    const angle = a.angleTo(b);
    const n = 120;
    const pos: number[] = [];
    const ts: number[] = [];
    const q = new THREE.Quaternion();
    const axis = new THREE.Vector3().crossVectors(a, b).normalize();
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      q.setFromAxisAngle(axis, angle * s);
      const p = a.clone().applyQuaternion(q);
      const lift = 1 + Math.sin(Math.PI * s) * (0.08 + angle * 0.18);
      p.multiplyScalar(radius * lift);
      pos.push(p.x, p.y, p.z);
      ts.push(s);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.Float32BufferAttribute(ts, 1));
    return g;
  }, [arc, radius]);
  useFrame(() => {
    if (!mat.current) return;
    const p = film.progressIn(chapter);
    mat.current.uniforms.uDraw.value = Math.min(1, Math.max(0, (p - arc.start) / (arc.end - arc.start)));
    mat.current.uniforms.uOn.value = Math.max(film.presence(chapter), 0);
    mat.current.uniforms.uTime.value = film.time;
  });
  return (
    <line>
      <primitive object={geo} attach="geometry" />
      <shaderMaterial
        ref={mat}
        vertexShader={arcVert}
        fragmentShader={arcFrag}
        uniforms={{ uDraw: { value: 0 }, uColor: { value: new THREE.Color(arc.color) }, uOn: { value: 0 }, uTime: { value: 0 } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </line>
  );
}

function Pin({ city, radius, chapter, color }: { city: City; radius: number; chapter: number; color: string }) {
  const ring = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLon(city.lat, city.lon, radius * 1.005), [city, radius]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()), [pos]);
  const dotMat = useRef<THREE.MeshBasicMaterial>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const on = film.presence(chapter);
    const t = (film.time * 0.8) % 1;
    if (ring.current) ring.current.scale.setScalar(0.2 + t * 0.9);
    if (ringMat.current) ringMat.current.opacity = (1 - t) * on;
    if (dotMat.current) dotMat.current.opacity = on;
  });
  return (
    <group position={pos} quaternion={quat}>
      <mesh>
        <circleGeometry args={[0.09, 24]} />
        <meshBasicMaterial ref={dotMat} color={color} transparent toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring}>
        <ringGeometry args={[0.45, 0.5, 48]} />
        <meshBasicMaterial ref={ringMat} color={color} transparent depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

type EarthProps = {
  position: THREE.Vector3;
  radius: number;
  chapter: number;
  focus: { lat: number; lon: number };
  cities: City[];
  arcs: Arc[];
  color?: string;
};

export function Earth({ position, radius, chapter, focus, cities, arcs, color = "#2bff88" }: EarthProps) {
  const outer = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const dotMat = useRef<THREE.ShaderMaterial>(null);
  const atmoMat = useRef<THREE.ShaderMaterial>(null);
  const gridMat = useRef<THREE.LineBasicMaterial>(null);

  const dotGeo = useMemo(() => {
    const d = dots as number[];
    const pos = new Float32Array((d.length / 2) * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < d.length; i += 2) {
      latLon(d[i], d[i + 1], radius, v);
      pos.set([v.x, v.y, v.z], (i / 2) * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return g;
  }, [radius]);

  const gridGeo = useMemo(() => {
    const seg: number[] = [];
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    for (let lat = -60; lat <= 60; lat += 30)
      for (let lon = 0; lon < 360; lon += 4) {
        latLon(lat, lon, radius * 0.995, a);
        latLon(lat, lon + 4, radius * 0.995, b);
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    for (let lon = 0; lon < 360; lon += 30)
      for (let lat = -88; lat < 88; lat += 4) {
        latLon(lat, lon, radius * 0.995, a);
        latLon(lat + 4, lon, radius * 0.995, b);
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    return g;
  }, [radius]);

  // Face the chapter's camera keyframe so the focus city sits front and centre.
  const camAt = useMemo(() => cameraCurve.getPoint(keyT[chapter]), [chapter]);

  useFrame(() => {
    const on = film.presence(chapter);
    if (outer.current) {
      outer.current.visible = on > 0.001;
      outer.current.lookAt(camAt);
    }
    if (spin.current) {
      // Slow drift around the focus so it feels alive, not pinned.
      spin.current.rotation.set(focus.lat * (Math.PI / 180) - 0.12, -focus.lon * (Math.PI / 180) + Math.sin(film.time * 0.1) * 0.12 + 0.2, 0, "XYZ");
    }
    if (dotMat.current) dotMat.current.uniforms.uOn.value = on;
    if (atmoMat.current) atmoMat.current.uniforms.uOn.value = on;
    if (gridMat.current) gridMat.current.opacity = 0.05 * on;
  });

  const col = useMemo(() => new THREE.Color(color), [color]);

  return (
    <group ref={outer} position={position}>
      <group ref={spin}>
        <mesh renderOrder={-1}>
          <sphereGeometry args={[radius * 0.985, 64, 64]} />
          <meshBasicMaterial color="#000805" transparent opacity={0.92} />
        </mesh>
        <points geometry={dotGeo}>
          <shaderMaterial ref={dotMat} vertexShader={dotVert} fragmentShader={dotFrag} uniforms={{ uPx: PX, uColor: { value: col }, uOn: { value: 0 } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
        <lineSegments geometry={gridGeo}>
          <lineBasicMaterial ref={gridMat} color={color} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
        </lineSegments>
        {cities.map((c) => (
          <Pin key={c.name} city={c} radius={radius} chapter={chapter} color="#ffffff" />
        ))}
        {arcs.map((a, i) => (
          <ArcLine key={i} arc={a} radius={radius} chapter={chapter} />
        ))}
      </group>
      <mesh scale={1.12}>
        <sphereGeometry args={[radius, 64, 64]} />
        <shaderMaterial ref={atmoMat} vertexShader={atmoVert} fragmentShader={atmoFrag} uniforms={{ uColor: { value: col }, uOn: { value: 0 } }} transparent depthWrite={false} side={THREE.BackSide} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}
