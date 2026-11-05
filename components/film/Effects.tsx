"use client";
/**
 * Film finish, in two passes:
 * 1. Fracture + bloom. During the dimensional shift (B2C to B2B) the frame
 *    breaks into shards, each a window at a different depth, with hairline
 *    cracks, then re-forms. Bloom glows through the same shards.
 * 2. Optics + film. Volumetric light shafts streaming from the world's light
 *    (the black hole's disk, the B2B star, the destination), traced at
 *    quarter resolution so they cost almost nothing; lens fringing that grows
 *    with speed, crisis and the fracture; then the grade (shadows lean toward
 *    the colour of the current dimension, crisis burns warm), the hard-cut
 *    flashes, a projector's exposure flicker, the vignette, and grain that
 *    changes every frame at 24 fps. The void stays true black.
 * Reduced motion: no fracture, no flashes, no flicker, still grain.
 */
import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { Effect, EffectAttribute, ShaderPass } from "postprocessing";
import * as THREE from "three";
import { film } from "@/lib/film";
import { prng } from "@/lib/math";
import { BLACK_HOLE, DESTINATION, EARTH_1, EARTH_2, EARTH_RADIUS, ORBITS } from "@/lib/stage";
import { scoreClick } from "@/lib/score";

const SHARDS = 14;

/** Nearest shard seed (xy), its index (z), and the gap to the second nearest (w). */
const shardGLSL = /* glsl */ `
  uniform vec2 uShard[${SHARDS}];
  float fh(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  vec4 shardAt(vec2 q) {
    float d1 = 1e9; float d2 = 1e9; float k = 0.0; vec2 c = vec2(0.0);
    for (int i = 0; i < ${SHARDS}; i++) {
      float d = distance(q, uShard[i]);
      if (d < d1) { d2 = d1; d1 = d; k = float(i); c = uShard[i]; }
      else if (d < d2) { d2 = d; }
    }
    return vec4(c, k, d2 - d1);
  }
`;

const fractureFrag = /* glsl */ `
  uniform float uFracture;
  uniform vec3 uTint;
  uniform vec3 uMass; // mass: screen xy, strength
  uniform float uEmit; // 0: a dark horizon; 1: a wormhole that emits light
  uniform vec4 uClick; // a click's wormhole: screen xy, strength, size
  uniform float uClickDark; // 1: a dark wormhole that swallows light
  ${shardGLSL}

  // Gravity: light is pulled toward a mass and wrapped around it, twisting.
  vec2 warpAt(vec2 uv, vec2 C, float strength, float size, float swirl) {
    if (strength < 0.001) return uv;
    vec2 asp = vec2(aspect, 1.0);
    vec2 d = (uv - C) * asp;
    float r = length(d) + 1e-4;
    float rE = size * strength;
    float pull = rE * rE / (r * r + rE * rE * 0.35);
    vec2 t = vec2(-d.y, d.x) / r;
    d -= d / r * pull * r * 0.9 - t * pull * swirl;
    return C + d / asp;
  }
  vec2 gravityWarp(vec2 uv) {
    uv = warpAt(uv, uMass.xy, uMass.z, 0.16, 0.06 + uEmit * 0.12);
    return warpAt(uv, uClick.xy, uClick.z, uClick.w, 0.3);
  }
  // A wormhole that throws light out: a white-hot core, a ring, turning rays.
  vec3 emission(vec2 uv, vec2 C, float strength, float size) {
    vec2 d = (uv - C) * vec2(aspect, 1.0);
    float r = length(d);
    float rE = size * strength + 1e-4;
    float core = exp(-pow(r / (rE * 0.32), 2.0));
    float ring = exp(-pow((r - rE * 0.8) / (rE * 0.1), 2.0));
    float rays = pow(abs(sin(atan(d.y, d.x) * 6.0 + time * 0.35 - r * 9.0)), 24.0) * exp(-r / (rE * 0.9));
    return vec3(1.0, 0.84, 0.6) * (core * 1.2 + ring * 0.4 + rays * 0.14) * strength;
  }

  void mainUv(inout vec2 uv) {
    uv = gravityWarp(uv);
    if (uFracture < 0.001) return;
    vec2 asp = vec2(aspect, 1.0);
    vec2 q = (uv - 0.5) * asp;
    vec4 s = shardAt(q);
    float h1 = fh(s.z + 1.0), h2 = fh(s.z + 7.0), h3 = fh(s.z + 13.0);
    // Each shard is a window at a different depth: zoom about its own centre,
    // turn a little, slide a little.
    float z = 1.0 + (h1 - 0.45) * 0.9 * uFracture;
    float ang = (h2 - 0.5) * 0.35 * uFracture;
    vec2 rel = q - s.xy;
    rel = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * rel / z;
    vec2 slide = (vec2(h2, h3) - 0.5) * 0.09 * uFracture;
    // And the whole frame falls inward: the zoom down the infinite axis.
    vec2 qq = (s.xy + rel + slide) / (1.0 + 0.22 * uFracture);
    uv = qq / asp + 0.5;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    if (uMass.z > 0.001) {
      if (uEmit > 0.5) c += emission(vUv, uMass.xy, uMass.z, 0.16);
      else {
        vec2 d = (vUv - uMass.xy) * vec2(aspect, 1.0);
        float r = length(d);
        float rE = 0.16 * uMass.z;
        c *= mix(1.0, 0.15, exp(-pow(r / (rE * 0.45), 2.0)) * uMass.z);
        c += vec3(1.0, 0.75, 0.45) * exp(-pow((r - rE) / (rE * 0.08), 2.0)) * 0.12 * uMass.z;
      }
    }
    if (uClick.z > 0.001) {
      if (uClickDark > 0.5) {
        vec2 d = (vUv - uClick.xy) * vec2(aspect, 1.0);
        float r = length(d);
        float rE = uClick.w * uClick.z + 1e-4;
        c *= mix(1.0, 0.0, exp(-pow(r / (rE * 0.55), 2.0)));
        c += vec3(0.75, 0.85, 1.0) * exp(-pow((r - rE * 0.62) / (rE * 0.07), 2.0)) * 0.35 * uClick.z;
      } else c += emission(vUv, uClick.xy, uClick.z, uClick.w) * 0.8;
    }
    if (uFracture > 0.001) {
      vec4 s = shardAt((vUv - 0.5) * vec2(aspect, 1.0));
      // Hairline cracks that catch the light only near the peak of the shift.
      float edge = 1.0 - smoothstep(0.0, 0.0018, s.w);
      c *= 1.0 + (fh(s.z + 3.0) - 0.5) * 0.35 * uFracture;
      c += mix(vec3(0.75, 0.85, 1.0), uTint, 0.5) * edge * uFracture * uFracture * 0.45;
    }
    outputColor = vec4(c, inputColor.a);
  }
`;

class FractureEffect extends Effect {
  seeds: THREE.Vector2[];
  aspect = 0;
  constructor() {
    const r = prng(1313);
    const seeds = Array.from({ length: SHARDS }, () => new THREE.Vector2(r() - 0.5, r() - 0.5));
    super("FractureEffect", fractureFrag, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uFracture", new THREE.Uniform(0)],
        ["uTint", new THREE.Uniform(new THREE.Color("#2bff88"))],
        ["uMass", new THREE.Uniform(new THREE.Vector3(0.5, 0.5, 0))],
        ["uEmit", new THREE.Uniform(1)],
        ["uClick", new THREE.Uniform(new THREE.Vector4(0.5, 0.5, 0, 0.1))],
        ["uClickDark", new THREE.Uniform(0)],
        ["uShard", new THREE.Uniform(seeds.map((s) => s.clone()))],
      ]),
    });
    this.seeds = seeds;
  }
}

/** Light shafts, traced into a quarter-resolution buffer from the full frame. */
const shaftsVert = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 1.0, 1.0); }
`;
const shaftsFrag = /* glsl */ `
  uniform sampler2D inputBuffer;
  uniform vec2 uLight;
  uniform float uStrength;
  uniform vec3 uTint;
  uniform float uSeed;
  varying vec2 vUv;
  float shaftHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    // March from this pixel toward the light, gathering only bright light.
    const int N = 32;
    vec2 delta = (vUv - uLight) * (0.92 / float(N));
    vec2 p = vUv - delta * shaftHash(vUv * 731.0 + uSeed);
    float w = 1.0;
    vec3 acc = vec3(0.0);
    for (int i = 0; i < N; i++) {
      p -= delta;
      vec3 s = texture2D(inputBuffer, clamp(p, 0.0, 1.0)).rgb;
      float l = dot(s, vec3(0.2126, 0.7152, 0.0722));
      acc += s * smoothstep(0.75, 2.4, l) * w;
      w *= 0.935;
    }
    gl_FragColor = vec4(acc * uStrength * uTint / float(N), 1.0);
  }
`;

const opticsFrag = /* glsl */ `
  uniform vec2 uCA;
  uniform sampler2D uShafts;
  uniform float uShaftOn;
  uniform vec3 uFlare; // light xy on screen, strength
  uniform vec3 uFlareTint;
  // Anamorphic lens flare: a horizontal streak through the light, a soft halo,
  // and ghosts reflected through the centre of the lens.
  vec3 flare(vec2 uv) {
    vec2 asp = vec2(aspect, 1.0);
    vec2 L = uFlare.xy;
    vec2 d = (uv - L) * asp;
    vec3 f = vec3(0.0);
    f += vec3(0.55, 0.75, 1.0) * exp(-abs(d.y) * 340.0) * exp(-abs(d.x) * 1.6) * 0.5;
    f += uFlareTint * exp(-length(d) * 9.0) * 0.18;

    return f * uFlare.z;
  }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    // Lens fringing: red and blue land a hair apart.
    if (uCA.x > 0.00001) {
      c.r = texture2D(inputBuffer, uv + uCA).r;
      c.b = texture2D(inputBuffer, uv - uCA).b;
    }
    if (uShaftOn > 0.5) c += texture2D(uShafts, uv).rgb;
    if (uFlare.z > 0.002) c += flare(uv);
    outputColor = vec4(c, inputColor.a);
  }
`;

class OpticsEffect extends Effect {
  rt: THREE.WebGLRenderTarget;
  shafts: THREE.ShaderMaterial;
  pass: ShaderPass;
  constructor() {
    const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
    super("OpticsEffect", opticsFrag, {
      attributes: EffectAttribute.CONVOLUTION,
      uniforms: new Map<string, THREE.Uniform>([
        ["uCA", new THREE.Uniform(new THREE.Vector2(0, 0))],
        ["uShafts", new THREE.Uniform(rt.texture)],
        ["uShaftOn", new THREE.Uniform(0)],
        ["uFlare", new THREE.Uniform(new THREE.Vector3(0.5, 0.5, 0))],
        ["uFlareTint", new THREE.Uniform(new THREE.Color(1, 0.8, 0.6))],
      ]),
    });
    this.rt = rt;
    this.shafts = new THREE.ShaderMaterial({
      uniforms: {
        inputBuffer: { value: null },
        uLight: { value: new THREE.Vector2(0.5, 0.5) },
        uStrength: { value: 0 },
        uTint: { value: new THREE.Color(1, 1, 1) },
        uSeed: { value: 0 },
      },
      vertexShader: shaftsVert,
      fragmentShader: shaftsFrag,
      depthTest: false,
      depthWrite: false,
    });
    this.pass = new ShaderPass(this.shafts, "inputBuffer");
  }
  update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget) {
    const on = this.shafts.uniforms.uStrength.value > 0.002;
    this.uniforms.get("uShaftOn")!.value = on ? 1 : 0;
    if (on) this.pass.render(renderer, inputBuffer, this.rt);
  }
  setSize(width: number, height: number) {
    this.rt.setSize(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
  }
  dispose() {
    this.rt.dispose();
    this.shafts.dispose();
    this.pass.dispose();
    super.dispose();
  }
}

const filmFrag = /* glsl */ `
  uniform float uFlash;
  uniform float uCrisis;
  uniform float uGrain;
  uniform float uFrame;
  uniform float uFlicker;
  uniform vec3 uTint;
  float gh(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  float gh2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec3 c = inputColor.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // Grade: shadows lean toward the dimension's colour; crisis burns warm.
    float shadow = 1.0 - smoothstep(0.0, 0.35, l);
    c = mix(c, c * (0.55 + uTint * 0.9), 0.18 * shadow);
    c = mix(c, c * vec3(1.16, 0.9, 0.74), uCrisis * 0.32);
    // Crush the void: true black stays black.
    c = max(c - 0.0035, 0.0) * 1.0035;
    // Hard cuts: a white shatter, an exposure pop, or a smash to black.
    c = uFlash >= 0.0 ? c + vec3(1.0, 0.97, 0.92) * uFlash : c * (1.0 + uFlash);
    // Exposure flicker, frame-locked like a projector.
    c *= 1.0 + (gh(uFrame) - 0.5) * 0.012 * uFlicker;
    // Vignette: an anamorphic oval, untouched by the shatter.
    vec2 vq = (vUv - 0.5) * vec2(aspect * 0.78, 1.0);
    c *= mix(1.0, smoothstep(0.95, 0.28, length(vq)), 0.85);
    // Grain: a fresh frame of it 24 times a second, strongest in the mid-tones,
    // added in a perceptual space so black stays black.
    vec2 gp = floor(vUv * resolution / 1.5);
    float n = gh2(gp + fract(uFrame * 0.1373) * 517.0) + gh2(gp * 1.37 + fract(uFrame * 0.2711) * 911.0) - 1.0;
    vec3 pc = sqrt(max(c, 0.0));
    float pl = dot(pc, vec3(0.2126, 0.7152, 0.0722));
    pc += n * uGrain * (0.3 + 0.7 * smoothstep(0.02, 0.45, pl)) * (1.0 - 0.5 * smoothstep(0.6, 1.0, pl));
    c = pc * pc;
    outputColor = vec4(c, inputColor.a);
  }
`;

class FilmEffect extends Effect {
  constructor() {
    super("FilmEffect", filmFrag, {
      uniforms: new Map<string, THREE.Uniform>([
        ["uFlash", new THREE.Uniform(0)],
        ["uCrisis", new THREE.Uniform(0)],
        ["uGrain", new THREE.Uniform(0.055)],
        ["uFrame", new THREE.Uniform(0)],
        ["uFlicker", new THREE.Uniform(1)],
        ["uTint", new THREE.Uniform(new THREE.Color("#2bff88"))],
      ]),
    });
  }
}

/** Where each world's light comes from, how strongly it streams, and its colour. */
const LIGHTS = [
  { pos: BLACK_HOLE, tint: new THREE.Color(1.0, 0.78, 0.52), weight: () => film.presence(2) * Math.min(1, film.bhOpen) * (film.u < 2.3 ? 1 : 0) * 0.85 },
  { pos: ORBITS, tint: new THREE.Color(0.75, 0.85, 1.0), weight: () => film.presence(5) * 0.8 },
  // The destination's light dims once the index arrives: the film comes to rest.
  { pos: DESTINATION, tint: new THREE.Color(0.85, 1.0, 0.92), weight: () => Math.max(film.presence(8) * (1 - 0.9 * Math.min(1, Math.max(0, (film.rawIn(8) - 0.76) / 0.1))), film.presence(0) * 0.65, film.presence(7) * 0.3) * 0.8 },
];

export function Effects() {
  const fracture = useMemo(() => new FractureEffect(), []);
  const optics = useMemo(() => new OpticsEffect(), []);
  const grade = useMemo(() => new FilmEffect(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const view = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ camera, size }) => {
    const calm = film.reduced ? 0 : 1;

    // Fracture.
    fracture.uniforms.get("uFracture")!.value = film.fracture;
    (fracture.uniforms.get("uTint")!.value as THREE.Color).copy(film.tint);
    const aspect = size.width / Math.max(1, size.height);
    if (Math.abs(aspect - fracture.aspect) > 1e-3) {
      fracture.aspect = aspect;
      const arr = fracture.uniforms.get("uShard")!.value as THREE.Vector2[];
      fracture.seeds.forEach((s, i) => arr[i].set(s.x * aspect, s.y));
    }

    // Lens fringing.
    const stress = film.presence(2) * Math.min(1, film.progressIn(2) * 2);
    const k = Math.min(0.006, film.speed * 0.005 + stress * 0.002 + film.crisis * 0.0012 + film.fracture * 0.0018) * calm;
    (optics.uniforms.get("uCA")!.value as THREE.Vector2).set(k, k * 0.35);

    // Shafts from the strongest light in frame.
    let best = 0;
    let light = LIGHTS[0];
    for (const L of LIGHTS) {
      const w = L.weight();
      if (w > best) {
        best = w;
        light = L;
      }
    }
    let strength = 0;
    const su = optics.shafts.uniforms;
    if (best > 0.01) {
      view.copy(light.pos).applyMatrix4(camera.matrixWorldInverse);
      if (view.z < 0) {
        v.copy(light.pos).project(camera);
        const off = Math.max(Math.abs(v.x), Math.abs(v.y));
        strength = best * (1 - Math.min(1, Math.max(0, (off - 1.1) / 0.8)));
        (su.uLight.value as THREE.Vector2).set(v.x * 0.5 + 0.5, v.y * 0.5 + 0.5);
      }
    }
    su.uStrength.value = strength * 0.42;
    const flareU = optics.uniforms.get("uFlare")!.value as THREE.Vector3;
    flareU.set((su.uLight.value as THREE.Vector2).x, (su.uLight.value as THREE.Vector2).y, film.reduced ? 0 : strength * 0.9);
    (optics.uniforms.get("uFlareTint")!.value as THREE.Color).copy(light.tint);
    film.light.copy(light.pos);
    film.lightOn = strength;

    // The crisis mass bends everything on the canvas around it.
    const mass = fracture.uniforms.get("uMass")!.value as THREE.Vector3;
    let mz = 0;
    if (film.section >= 3 && film.crisis > 0.02 && !film.reduced) {
      view.copy(film.focus).applyMatrix4(camera.matrixWorldInverse);
      if (view.z < 0) {
        v.copy(film.focus).project(camera);
        mass.x = v.x * 0.5 + 0.5;
        mass.y = v.y * 0.5 + 0.5;
        mz = film.crisis;
      }
    }
    // The final climax: after contact the whole frame bends around a dark
    // centre, then cracks open into the tesseract.
    const horizon = film.horizon;
    fracture.uniforms.get("uEmit")!.value = 1;
    if (mz < 0.02 && horizon > 0.02) {
      mass.x = 0.5;
      mass.y = 0.5;
      mz = Math.min(1.4, horizon * 1.4);
      fracture.uniforms.get("uEmit")!.value = 0;
    }
    mass.z = mz;

    // A click opens a wormhole where it lands: a big one inside a globe, a small one anywhere else.
    const click = fracture.uniforms.get("uClick")!.value as THREE.Vector4;
    const age = film.clock - film.clickAt;
    if (age < 1.6 && !film.reduced) {
      if (film.clickBig < 0) {
        film.clickBig = 0;
        const cam = camera as THREE.PerspectiveCamera;
        for (const [pos, ch] of [[EARTH_1, 3], [EARTH_2, 6]] as const) {
          if (film.presence(ch) < 0.4) continue;
          view.copy(pos).applyMatrix4(camera.matrixWorldInverse);
          if (view.z >= 0) continue;
          v.copy(pos).project(camera);
          const rad = (EARTH_RADIUS / -view.z) / Math.tan((cam.fov * Math.PI) / 360) * 0.5;
          const dx = (film.clickX - (v.x * 0.5 + 0.5)) * (size.width / size.height);
          const dy = film.clickY - (v.y * 0.5 + 0.5);
          if (Math.hypot(dx, dy) < rad) film.clickBig = 1;
        }
        scoreClick(film.clickBig === 1);
      }
      const big = film.clickBig === 1 || film.clickDark;
      fracture.uniforms.get("uClickDark")!.value = film.clickDark ? 1 : 0;
      const env = Math.min(1, age / 0.12) * Math.exp(-age * 2.2);
      click.set(film.clickX, film.clickY, (big ? 1 : 0.5) * env, big ? 0.2 : 0.07);
    } else click.z = 0;
    su.uSeed.value = calm ? (film.clock * 13.7) % 97 : 0;
    (su.uTint.value as THREE.Color).copy(light.tint);

    // Film.
    const u = grade.uniforms;
    u.get("uCrisis")!.value = film.crisis;
    (u.get("uTint")!.value as THREE.Color).copy(film.tint);
    u.get("uFrame")!.value = film.reduced ? 0 : Math.floor(film.clock * 60);
    u.get("uFlicker")!.value = 0; // no exposure flicker: it read as a fault, not as film
    const t = film.sinceCut;
    let flash = 0;
    if (!film.reduced && t < 1.2) {
      if (film.cutKind < 0) flash = -(t < 0.09 ? 1 : Math.exp(-(t - 0.09) * 7));
      else if (film.cutKind === 1) flash = 0.5 * Math.exp(-t * 9);
      else flash = 0.16 * Math.exp(-t * 12);
    }
    // Inside the black hole: a continuous fade through black, not a cut.
    if (film.dark > 0) flash = Math.min(flash, -film.dark);
    u.get("uFlash")!.value = flash;
  });

  return (
    <EffectComposer multisampling={0}>
      <primitive object={fracture} dispose={null} />
      <Bloom intensity={1.1} luminanceThreshold={0.16} luminanceSmoothing={0.35} mipmapBlur radius={0.8} levels={8} />
      <primitive object={optics} dispose={null} />
      <primitive object={grade} dispose={null} />
    </EffectComposer>
  );
}
