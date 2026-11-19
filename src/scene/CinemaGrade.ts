import { BlendFunction, Effect } from 'postprocessing';
import * as THREE from 'three';

/**
 * A film grade: split toning (cool, deep shadows; warm highlights), a gentle shoulder that keeps
 * the lit snow from clipping, and a faint warm halation round the brightest lights, the way
 * film blooms red into the emulsion. `strength` blends it in (0 = off).
 */
const fragment = /* glsl */ `
uniform float strength;
uniform vec3 shadowTint;
uniform vec3 highlightTint;
uniform float shoulder;

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Shadows lean blue-teal, highlights lean amber; midtones stay put.
  vec3 tint = mix(shadowTint, vec3(1.0), smoothstep(0.0, 0.35, l));
  tint = mix(tint, highlightTint, smoothstep(0.45, 1.1, l));
  vec3 g = c * tint;
  // Roll the top off softly instead of letting it clip.
  g = g / (1.0 + shoulder * max(vec3(0.0), g - 0.75));
  // Halation: the brightest pixels pick up a red-orange fringe.
  float hot = smoothstep(0.85, 1.6, l);
  g += vec3(0.06, 0.018, 0.0) * hot;
  outputColor = vec4(mix(inputColor.rgb, g, strength), inputColor.a);
}
`;

export class CinemaGradeEffect extends Effect {
  constructor({ strength = 1, shadowTint = '#cbd5f2', highlightTint = '#ffe6c6', shoulder = 0.6 } = {}) {
    super('CinemaGradeEffect', fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['strength', new THREE.Uniform(strength)],
        ['shadowTint', new THREE.Uniform(new THREE.Color(shadowTint))],
        ['highlightTint', new THREE.Uniform(new THREE.Color(highlightTint))],
        ['shoulder', new THREE.Uniform(shoulder)],
      ]),
    });
  }
  set strength(v: number) {
    this.uniforms.get('strength')!.value = v;
  }
}
