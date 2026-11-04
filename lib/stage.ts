/**
 * Where everything sits in the film's 3D space, and the camera's route.
 * The line you are handed (HANDED) runs first person under the camera and
 * falls into the black hole. The real career re-emerges, through a wormhole,
 * as a curving worldline.
 */
import * as THREE from "three";

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const SCIENCE = v(-4, 2, -36);
export const BLACK_HOLE = v(0, 9, -92);
export const BH_RADIUS = 0.9; // event horizon
/** The accretion disk's normal (the plane light spirals in along). */
export const BH_NORMAL = v(0.12, 1, 0.3).normalize();
export const BH_BOUNDS = 11; // raymarch sphere
export const EARTH_1 = v(-42, 0, -236);
export const EARTH_RADIUS = 7.5;
export const NETWORK = v(-62, 14, -305);
export const ORBITS = v(-10, 25, -385);
export const EARTH_2 = v(32, 9, -466);
export const TESSERACT = v(10, 1, -545);
export const DESTINATION = v(0, 0, -1200);

/**
 * Camera route. `key` marks the points that are chapter keyframes.
 * Shot by shot: ride the line in (00), hold on the crystal (01), track past
 * its right side and round behind it following the light (01 to 02), face
 * the hole with the light coming in beside you (02), dolly straight in and
 * through the horizon into the tunnel (02 to 03), come out on a wide shot
 * with the globe centred (03).
 */
const route: { p: THREE.Vector3; look?: THREE.Vector3; key?: number; horizon?: true; wormhole?: true }[] = [
  { p: v(6.5, 2.2, 34), look: v(0, 0.4, -40), key: 0 },
  { p: v(7, 1.2, 8) },
  { p: v(8, 2.2, -16), look: v(-3, 1.8, -36), key: 1 },
  { p: v(7, 3, -33) }, // tracking past the crystal...
  { p: v(2.2, 3.8, -48) }, // ...round behind it, with the light
  { p: v(-3, 4.2, -60), look: v(0, 6.2, -92), key: 2 },
  { p: v(-1.2, 6.8, -78) },
  { p: v(0.2, 9, -91.6), horizon: true, wormhole: true }, // through the horizon
  { p: v(-4, 7, -112) },
  { p: v(-14, 5, -150) },
  { p: v(-24, 4, -186), wormhole: true }, // wormhole exit
  { p: v(-15.3, 8, -196.9), look: v(-42, 0, -236), key: 3 },
  { p: v(-36, 12, -255) },
  { p: v(-44, 20, -280), look: v(-62, 13, -305), key: 4 },
  { p: v(-22, 30, -330) },
  { p: v(10, 33, -362), look: v(-10, 24, -386), key: 5 },
  { p: v(18, 22, -415) },
  { p: v(15, 14, -444), look: v(36, 8.5, -463), key: 6 },
  { p: v(20, 6, -500) },
  { p: v(17, 4, -527), look: v(10, -2.5, -545), key: 7 },
  { p: v(14, 2, -560) },
  { p: v(9, 1.5, -585), look: v(0, 120, -1200), key: 8 },
];

export const cameraCurve = new THREE.CatmullRomCurve3(route.map((r) => r.p), false, "centripetal");
const M = route.length - 1;
export const keyT: number[] = [];
export const keyLook: THREE.Vector3[] = [];
route.forEach((r, i) => {
  if (r.key !== undefined) {
    keyT[r.key] = i / M;
    keyLook[r.key] = r.look!;
  }
});

/** Curve parameter for chapter coordinate u (3.5 = halfway from chapter 3 to 4). */
export function tForU(u: number) {
  const i = Math.min(keyT.length - 2, Math.max(0, Math.floor(u)));
  const f = Math.min(1, Math.max(0, u - i));
  return keyT[i] + (keyT[i + 1] - keyT[i]) * f;
}

/** The wormhole runs along the camera route between these parameters. */
const holes = route.flatMap((r, i) => (r.wormhole ? [i / M] : []));
export const WORMHOLE_T = [holes[0], holes[1]] as const;
/** Camera coordinate u at which the camera passes through the black hole's horizon. */
const tH = route.findIndex((r) => r.horizon) / M;
export const HORIZON_U = 2 + (tH - keyT[2]) / (keyT[3] - keyT[2]);

/**
 * The career worldline: from the wormhole exit through every chapter.
 * The GoMechanic years rise past the first Earth and arc through open sky
 * above it, so the turbulence plays in frame from chapter 03's camera (top
 * centre, clear of the words), then cross chapter 04's frame through the
 * partner network.
 */
export const careerCurve = new THREE.CatmullRomCurve3(
  [
    v(-24, 4, -186),
    v(-32, 1.5, -212),
    v(-35, -4.7, -243.5),
    v(-40.6, 6.2, -257.8),
    v(-67.8, 11.4, -254.8),
    v(-58, 12, -300),
    v(-40, 22, -340),
    v(-8, 24, -372),
    v(12, 20, -410),
    v(28, 11, -446),
    v(26, 5, -490),
    v(12, -2, -530),
    v(10, -3, -556),
    v(5, -3, -620),
    v(0, 0, -1100),
  ],
  false,
  "centripetal",
);

/**
 * The line you are handed (chapters 00 to 02), seen first person: it starts
 * under the viewer and runs ahead of the camera, bends around the school's
 * crystal into the centre of that frame, then comes in from the left and
 * spirals into the black hole along its disk. Nothing leaves the far side.
 */
function handedLine() {
  const pts = [
    v(6.2, 0.6, 56),
    v(6.4, 0.6, 30), // under the opening camera
    v(6.8, -0.2, 8),
    v(7.8, 0.6, -12), // under chapter 01's camera
    v(5.4, 0.2, -26),
    v(2.0, 0.6, -34), // around the crystal's right side...
    v(-1.5, 1.4, -43), // ...behind it...
    v(-9, 2.6, -46), // ...to the centre of chapter 01's frame
    v(-6, 2.8, -62), // beside and below chapter 02's camera...
    v(-1.5, 7.2, -80), // ...in from the left of its frame
  ];
  // The fall: about one and a half turns along the disk, tightening to the horizon.
  const n = BH_NORMAL;
  const e1 = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 0, 1)).normalize();
  const e2 = new THREE.Vector3().crossVectors(n, e1);
  const rel = pts[pts.length - 1].clone().sub(BLACK_HOLE);
  const h0 = rel.dot(n);
  const a0 = Math.atan2(rel.dot(e2), rel.dot(e1));
  const r0 = Math.hypot(rel.dot(e1), rel.dot(e2));
  const N = 36;
  for (let k = 1; k <= N; k++) {
    const s = k / N;
    // Clockwise seen from above: the outer arm sweeps the left of chapter 02's
    // frame and behind the hole, the inner arm comes round the right and falls in.
    const a = a0 - s * Math.PI * 2 * 1.45;
    const r = 0.95 + (r0 - 0.95) * Math.pow(1 - s, 1.25);
    pts.push(
      BLACK_HOLE.clone()
        .addScaledVector(e1, Math.cos(a) * r)
        .addScaledVector(e2, Math.sin(a) * r)
        .addScaledVector(n, h0 * Math.pow(1 - s, 2.2)),
    );
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  // Arc-length fraction at each named control point.
  const lengths = curve.getLengths(4000);
  const total = lengths[lengths.length - 1];
  const at = (i: number) => lengths[Math.round((i / (pts.length - 1)) * 4000)] / total;
  return { curve, mark: { viewer: at(1), ahead: at(2), school: at(3), cube: at(4), centre: at(7), fall: at(9) } };
}
export const HANDED = handedLine();

/** Real city coordinates (degrees). */
export const CITIES = {
  gurugram: { lat: 28.4595, lon: 77.0266, name: "Gurugram" },
  bengaluru: { lat: 12.9716, lon: 77.5946, name: "Bengaluru" },
  dubai: { lat: 25.2048, lon: 55.2708, name: "Dubai" },
  usa: { lat: 39.8, lon: -98.6, name: "USA" },
};
