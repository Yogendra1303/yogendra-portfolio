/**
 * Shader warm-up registry. Offscreen scenes (the black hole's half-res
 * portal) and pass materials that only render on demand (light shafts)
 * register here, so the opening can compile them before the film moves.
 */
import type * as THREE from "three";

export const warm = { scenes: new Set<THREE.Scene>(), materials: new Set<THREE.Material>() };
