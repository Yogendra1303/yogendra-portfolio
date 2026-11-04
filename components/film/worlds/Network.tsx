"use client";
/**
 * Chapter 04: escape velocity. The partner network as a living structure:
 * 15 city clusters, 500+ workshops, wired to their hubs and hubs to each
 * other. It grows from a single hub as you scroll, then pulses with traffic.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { dotTexture } from "@/lib/dot";
import { film } from "@/lib/film";
import { prng } from "@/lib/math";
import { NETWORK } from "@/lib/stage";

const CLUSTERS = 15;
const NODES = 520;

const nodeVert = /* glsl */ `
  attribute float aOrder;
  attribute float aSize;
  uniform float uGrow;
  uniform float uTime;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float on = smoothstep(aOrder, aOrder + 0.04, uGrow);
    float tw = 0.75 + 0.25 * sin(uTime * 2.0 + aOrder * 90.0);
    vA = on * tw;
    gl_PointSize = aSize * on * (90.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const nodeFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uOn;
  varying float vA;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 1.8) * vA * uOn;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor * a * 1.4, a);
  }
`;
const edgeVert = /* glsl */ `
  attribute float aOrder;
  uniform float uGrow;
  varying float vA;
  void main() {
    vA = smoothstep(aOrder, aOrder + 0.05, uGrow);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const edgeFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uOn; uniform float uAlpha;
  varying float vA;
  void main() { float a = vA * uOn * uAlpha; gl_FragColor = vec4(uColor * a, a); }
`;

export function Network() {
  const data = useMemo(() => {
    const r = prng(500);
    const hubs: THREE.Vector3[] = [];
    // Hubs scattered on a flattened, slightly warped disk.
    for (let c = 0; c < CLUSTERS; c++) {
      const a = (c / CLUSTERS) * Math.PI * 2 + r() * 0.4;
      const rad = c === 0 ? 0 : 4 + r() * 9;
      hubs.push(new THREE.Vector3(Math.cos(a) * rad, (r() - 0.5) * 3, Math.sin(a) * rad * 0.7));
    }
    // Order hubs by distance from the first so growth spreads outward.
    const hubOrder = hubs.map((h, i) => ({ i, d: h.length() })).sort((a, b) => a.d - b.d);
    const hubRank = new Array(CLUSTERS);
    hubOrder.forEach((h, k) => (hubRank[h.i] = k / CLUSTERS));

    const pos: number[] = [];
    const order: number[] = [];
    const size: number[] = [];
    const ePos: number[] = [];
    const eOrder: number[] = [];
    hubs.forEach((h, c) => {
      pos.push(h.x, h.y, h.z);
      order.push(hubRank[c] * 0.6);
      size.push(4.5);
    });
    for (let i = 0; i < NODES - CLUSTERS; i++) {
      const c = Math.floor(r() * CLUSTERS);
      const h = hubs[c];
      const spread = 0.6 + Math.pow(r(), 1.5) * 2.4;
      const th = r() * Math.PI * 2, ph = Math.acos(2 * r() - 1);
      const p = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.5, Math.sin(ph) * Math.sin(th)).multiplyScalar(spread).add(h);
      const o = Math.min(0.97, hubRank[c] * 0.6 + 0.04 + r() * 0.35);
      pos.push(p.x, p.y, p.z);
      order.push(o);
      size.push(1.2 + r() * 1.4);
      ePos.push(h.x, h.y, h.z, p.x, p.y, p.z);
      eOrder.push(o, o);
    }
    // Hub-to-hub backbone: each hub links to its two nearest neighbours.
    const backbone: [number, number][] = [];
    hubs.forEach((h, i) => {
      const near = hubs
        .map((o, j) => ({ j, d: o.distanceTo(h) }))
        .filter((x) => x.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 2);
      near.forEach(({ j }) => {
        if (backbone.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) return;
        backbone.push([i, j]);
        const o = Math.max(hubRank[i], hubRank[j]) * 0.6;
        ePos.push(h.x, h.y, h.z, hubs[j].x, hubs[j].y, hubs[j].z);
        eOrder.push(o, o);
      });
    });

    const nodes = new THREE.BufferGeometry();
    nodes.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    nodes.setAttribute("aOrder", new THREE.Float32BufferAttribute(order, 1));
    nodes.setAttribute("aSize", new THREE.Float32BufferAttribute(size, 1));
    const edges = new THREE.BufferGeometry();
    edges.setAttribute("position", new THREE.Float32BufferAttribute(ePos, 3));
    edges.setAttribute("aOrder", new THREE.Float32BufferAttribute(eOrder, 1));
    return { nodes, edges, hubs, backbone };
  }, []);

  // Traffic: light packets travelling the backbone.
  const packets = useMemo(() => {
    const r = prng(77);
    const n = 60;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    return { g, n, edge: Array.from({ length: n }, () => Math.floor(r() * data.backbone.length)), t: Array.from({ length: n }, () => r()), sp: Array.from({ length: n }, () => 0.2 + r() * 0.5) };
  }, [data]);

  const g = useRef<THREE.Group>(null);
  const nm = useRef<THREE.ShaderMaterial>(null);
  const em = useRef<THREE.ShaderMaterial>(null);
  const pm = useRef<THREE.PointsMaterial>(null);

  useFrame((_, dt) => {
    const on = film.presence(4);
    if (g.current) {
      g.current.visible = on > 0.001;
      g.current.rotation.y += dt * 0.03;
    }
    const grow = Math.min(1, film.progressIn(4) / 0.5);
    for (const m of [nm.current, em.current]) {
      if (!m) continue;
      m.uniforms.uGrow.value = grow;
      m.uniforms.uOn.value = on;
      if (m.uniforms.uTime) m.uniforms.uTime.value = film.time;
    }
    if (pm.current) pm.current.opacity = on * Math.min(1, grow * 1.5);
    const arr = (packets.g.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < packets.n; i++) {
      packets.t[i] = (packets.t[i] + film.dt * packets.sp[i]) % 1;
      const [a, b] = data.backbone[packets.edge[i]];
      const A = data.hubs[a], B = data.hubs[b];
      const s = packets.t[i];
      arr[i * 3] = A.x + (B.x - A.x) * s;
      arr[i * 3 + 1] = A.y + (B.y - A.y) * s;
      arr[i * 3 + 2] = A.z + (B.z - A.z) * s;
    }
    packets.g.getAttribute("position").needsUpdate = true;
  });

  const col = useMemo(() => new THREE.Color("#7cffc4"), []);
  return (
    <group position={NETWORK} ref={g} scale={1.5}>
      <lineSegments geometry={data.edges}>
        <shaderMaterial ref={em} vertexShader={edgeVert} fragmentShader={edgeFrag} uniforms={{ uGrow: { value: 0 }, uOn: { value: 0 }, uAlpha: { value: 0.22 }, uColor: { value: col } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points geometry={data.nodes}>
        <shaderMaterial ref={nm} vertexShader={nodeVert} fragmentShader={nodeFrag} uniforms={{ uGrow: { value: 0 }, uOn: { value: 0 }, uTime: { value: 0 }, uColor: { value: col } }} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      <points geometry={packets.g}>
        <pointsMaterial map={dotTexture()} ref={pm} color="#ffffff" size={0.22} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
    </group>
  );
}
