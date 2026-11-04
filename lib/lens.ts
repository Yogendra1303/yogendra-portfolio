/**
 * Gravitational lensing of the sky. Up to three masses bend the light of the
 * background (stars, galaxies, nebula) and nothing else, so the worlds and
 * the words stay sharp while starlight curves around the black hole, around
 * a crisis, and around the heavy B2B star.
 *
 * Point-lens model with the source at infinity: a ray seen at angle θ from
 * the mass came from β = θ − θE²·θ/(θ² + c²). θE is the Einstein radius; c
 * softens the core for unseen masses (no singularity in the middle of frame).
 * Directions are in world space, measured from the camera.
 */
import * as THREE from "three";

export const LENSES = 3;

/** Shared uniform objects: every lensed material references these. */
export const lensUniforms = {
  uLensDir: { value: Array.from({ length: LENSES }, () => new THREE.Vector3(0, 0, -1)) },
  uLensE: { value: new Array<number>(LENSES).fill(0) },
  uLensC: { value: new Array<number>(LENSES).fill(0) },
};

const tmp = new THREE.Vector3();

/** Place lens i: a mass at `pos` with Einstein radius `thetaE` (radians), core softening `soft` (× θE). */
export function setLens(i: number, camera: THREE.Vector3, pos: THREE.Vector3, thetaE: number, soft = 0) {
  tmp.subVectors(pos, camera);
  const d = tmp.length();
  lensUniforms.uLensDir.value[i].copy(tmp).divideScalar(Math.max(d, 1e-4));
  lensUniforms.uLensE.value[i] = thetaE > 1e-4 ? thetaE : 0;
  lensUniforms.uLensC.value[i] = soft;
}

export const lensGLSL = /* glsl */ `
  uniform vec3 uLensDir[${LENSES}];
  uniform float uLensE[${LENSES}];
  uniform float uLensC[${LENSES}];

  // Pixel to source: where the light seen in direction d really came from.
  vec3 lensInverse(vec3 d) {
    for (int i = 0; i < ${LENSES}; i++) {
      float te = uLensE[i];
      if (te <= 0.0) continue;
      vec3 m = uLensDir[i];
      float c = clamp(dot(d, m), -1.0, 1.0);
      float th = acos(c);
      float cs = uLensC[i] * te;
      float b = th - te * te * th / (th * th + cs * cs + 1e-7);
      vec3 perp = d - m * c;
      float pl = length(perp);
      if (pl < 1e-6) continue;
      d = m * cos(b) + (perp / pl) * sin(b);
    }
    return d;
  }

  // Source to image, for point sources. img = +1 primary image (outside the
  // Einstein ring), -1 secondary (inside it, on the far side, flipped).
  // mu is the magnification: stars brighten as they line up behind the mass.
  vec3 lensForward(vec3 s, float img, out float mu) {
    mu = img > 0.0 ? 1.0 : 0.0;
    for (int i = 0; i < ${LENSES}; i++) {
      float te = uLensE[i];
      if (te <= 0.0) continue;
      vec3 m = uLensDir[i];
      float c = clamp(dot(s, m), -1.0, 1.0);
      float b = max(acos(c), 1e-4);
      float sq = sqrt(b * b + 4.0 * te * te);
      float th = 0.5 * (b + img * sq);
      vec3 perp = s - m * c;
      float pl = length(perp);
      perp = pl > 1e-6 ? perp / pl : normalize(cross(m, vec3(0.0, 1.0, 0.001)));
      s = m * cos(th) + perp * sin(th);
      float u = b / te;
      float u2 = u * u;
      float A = (u2 + 2.0) / (u * sqrt(u2 + 4.0));
      float mi = 0.5 * (A + img);
      mu = img > 0.0 ? mu * mi : max(mu, mi);
    }
    mu = min(mu, 8.0);
    return s;
  }
`;
