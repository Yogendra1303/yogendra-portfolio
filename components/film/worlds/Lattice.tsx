"use client";
/**
 * The dimensional shift between chapter 04 and 05 (B2C becomes B2B), and a
 * softer echo into chapter 07's 4D cube.
 * Concept: changing the kind of customer is not a step, it is a change of
 * dimension. Reference: a tesseract seen from inside, rooms repeating along
 * every axis forever. The camera zooms down one axis through endless cube
 * frames while the lattice twists a quarter turn (the fourth axis), and the
 * frame itself shatters into shards (Effects.tsx) and re-forms on the far side.
 * Feeling: vertigo, then a new, heavier order.
 * The lattice wraps around the camera, so it never ends. Hidden when calm.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { film } from "@/lib/film";
import { cameraCurve, keyT } from "@/lib/stage";

const CELLS = 6;
const SIZE = 8;
const HALF = (CELLS * SIZE) / 2;

const vert = /* glsl */ `
  attribute float aAxis;
  varying float vAxis;
  varying vec3 vW;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vAxis = aAxis;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const frag = /* glsl */ `
  uniform float uOn; uniform float uTime; uniform vec3 uCol; uniform float uFar;
  varying float vAxis; varying vec3 vW;
  void main() {
    // Per pixel: a line's endpoints are far away even where the line passes close.
    float vDist = distance(vW, cameraPosition);
    // Fade near the lens (no lines across your face) and into the far dark.
    float a = smoothstep(1.5, 5.0, vDist) * (1.0 - smoothstep(uFar * 0.35, uFar, vDist));
    // The travel axis glows brightest: that is the way through.
    vec3 c = mix(vec3(0.85, 0.9, 1.0), uCol, vAxis > 1.5 ? 0.2 : 0.75);
    float pulse = 0.7 + 0.3 * sin(dot(vW, vec3(0.31, 0.27, 0.23)) * 0.8 - uTime * 4.0);
    float g = a * uOn * pulse * (vAxis > 1.5 ? 1.25 : 0.7);
    gl_FragColor = vec4(c * g, g);
  }
`;

function latticeGeometry() {
  const pos: number[] = [];
  const axis: number[] = [];
  const n = CELLS;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= n; j++) {
      const a = i * SIZE - HALF, b = j * SIZE - HALF;
      pos.push(-HALF, a, b, HALF, a, b); // along x
      axis.push(0, 0);
      pos.push(a, -HALF, b, a, HALF, b); // along y
      axis.push(1, 1);
      pos.push(a, b, -HALF, a, b, HALF); // along z (the travel axis)
      axis.push(2, 2);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("aAxis", new THREE.Float32BufferAttribute(axis, 1));
  return g;
}

/** Orientation that points the lattice's z axis along a stretch of the route. */
function along(fromChapter: number) {
  const a = cameraCurve.getPoint(keyT[fromChapter]);
  const b = cameraCurve.getPoint(keyT[fromChapter + 1]);
  const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

export function Lattice() {
  const geo = useMemo(latticeGeometry, []);
  const g = useRef<THREE.Group>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  const q45 = useMemo(() => along(4), []);
  const q67 = useMemo(() => along(6), []);
  const tw = useMemo(() => new THREE.Quaternion(), []);
  const Z = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const local = useMemo(() => new THREE.Vector3(), []);
  const inv = useMemo(() => new THREE.Quaternion(), []);
  const blue = useMemo(() => new THREE.Color("#8fb8ff"), []);
  const uniforms = useMemo(() => ({ uOn: { value: 0 }, uTime: { value: 0 }, uCol: { value: new THREE.Color("#8fb8ff") }, uFar: { value: HALF * 1.1 } }), []);

  useFrame(({ camera }) => {
    const on = Math.max(film.fracture, film.tesseract * 0.85);
    if (!g.current || !mat.current) return;
    g.current.visible = on > 0.002;
    if (!g.current.visible) return;
    // Which fold are we in, and how far through it: the twist is a quarter
    // turn about the travel axis, the fourth dimension folding into view.
    const closing = film.tesseract > film.fracture;
    const q = closing ? q67 : film.u < 5.5 ? q45 : q67;
    const fu = film.u - Math.floor(film.u);
    tw.setFromAxisAngle(Z, closing ? film.scrub * Math.PI * 0.5 : (fu - 0.5) * Math.PI * 0.5);
    g.current.quaternion.copy(q).multiply(tw);
    // Wrap around the camera: snap the lattice to the nearest cell.
    inv.copy(g.current.quaternion).invert();
    local.copy(camera.position).applyQuaternion(inv);
    // Inside the closing tesseract, dragging time slides the whole lattice past you.
    const slide = closing ? film.scrub * SIZE * 6 : 0;
    local.set(Math.round(local.x / SIZE) * SIZE, Math.round(local.y / SIZE) * SIZE + SIZE * 0.5, Math.round((local.z - slide) / SIZE) * SIZE + slide);
    g.current.position.copy(local.applyQuaternion(g.current.quaternion));
    mat.current.uniforms.uOn.value = Math.min(1, on * 1.3);
    mat.current.uniforms.uTime.value = film.time;
    mat.current.uniforms.uCol.value.copy(film.tint).lerp(blue, 0.6);
  });

  return (
    <group ref={g}>
      <lineSegments geometry={geo} frustumCulled={false}>
        <shaderMaterial ref={mat} vertexShader={vert} fragmentShader={frag} uniforms={uniforms} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
    </group>
  );
}
