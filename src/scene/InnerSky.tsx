'use client';
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in useFrame by design (R3F). */
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GLOBE, LOOK } from '@/src/game/constants';
import { live } from '@/src/game/store';

/**
 * What you see past the village from inside the globe. The real glass is hidden in there (its
 * transmission ghosted the scene), which left the room outside — the knit cloth, the table —
 * showing through every gap between the houses. This dome sits just inside the glass and
 * paints a night instead: sky, stars, a moon where the moonlight comes from, two bands of snowy
 * hills, and a faint fresnel rim so the curve of the glass still reads.
 * Only drawn once the view is inside.
 */
export function InnerSky() {
  const mesh = useRef<THREE.Mesh>(null);
  const material = useMemo(() => {
    const moon = new THREE.Vector3(LOOK.moonPosition[0], GLOBE.floorY + LOOK.moonPosition[1] - GLOBE.centerY, LOOK.moonPosition[2]).normalize();
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: true,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uMoon: { value: moon },
        uFloor: { value: (GLOBE.floorY - GLOBE.centerY) / GLOBE.radius },
      },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        varying vec3 vNormalV;
        varying vec3 vViewPos;
        void main() {
          vDir = normalize(position);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vViewPos = mv.xyz;
          vNormalV = normalize(normalMatrix * -normal);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uMoon;
        uniform float uFloor;
        varying vec3 vDir;
        varying vec3 vNormalV;
        varying vec3 vViewPos;

        float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

        // Height (in dome y, -1..1) of a hill band at azimuth a.
        float hills(float a, float base, float amp, float seed) {
          return base + amp * (0.55 * sin(a * 3.0 + seed) + 0.3 * sin(a * 7.0 + seed * 2.1) + 0.15 * sin(a * 13.0 + seed * 3.7));
        }

        void main() {
          vec3 d = normalize(vDir);
          float a = atan(d.z, d.x);
          // Height above the floor, in dome units: 0 at the village floor, 1 at the zenith side.
          float up = (d.y - uFloor) / (1.0 - uFloor);

          vec3 horizon = vec3(0.075, 0.095, 0.15);
          vec3 zenith = vec3(0.008, 0.011, 0.024);
          vec3 col = mix(horizon, zenith, smoothstep(0.08, 0.75, up));

          // Moon and its halo.
          float m = dot(d, uMoon);
          col += vec3(0.55, 0.62, 0.8) * pow(max(m, 0.0), 40.0) * 0.35;
          col += vec3(1.0, 0.97, 0.9) * smoothstep(0.9965, 0.9978, m) * 2.2;

          // Stars: sparse, above the hills, a slow twinkle.
          vec3 cell = floor(d * 160.0);
          float h = hash(cell);
          float star = step(0.9965, h) * smoothstep(0.18, 0.4, up);
          star *= 0.55 + 0.45 * sin(uTime * (1.0 + h * 3.0) + h * 40.0);
          vec3 f = fract(d * 160.0) - 0.5;
          star *= smoothstep(0.32, 0.0, length(f));
          col += vec3(0.85, 0.9, 1.0) * star * 1.4;

          // Far hills (dark, bluish), then near hills (snow catching the moon).
          float far = hills(a, 0.16, 0.06, 1.3);
          float nearH = hills(a + 0.7, 0.085, 0.05, 4.2);
          if (up < far) {
            float rim = smoothstep(far - 0.012, far, up);
            col = mix(vec3(0.05, 0.06, 0.095), vec3(0.12, 0.14, 0.2), rim);
          }
          if (up < nearH) {
            float lit = 0.5 + 0.5 * dot(normalize(vec3(cos(a), 0.0, sin(a))), normalize(vec3(uMoon.x, 0.0, uMoon.z)));
            vec3 snow = mix(vec3(0.1, 0.115, 0.16), vec3(0.24, 0.27, 0.34), lit);
            float crest = smoothstep(nearH - 0.02, nearH, up);
            col = mix(snow, snow * 1.35, crest);
          }

          // The glass: a faint cool rim where you look along the curve.
          vec3 v = normalize(-vViewPos);
          float fres = pow(1.0 - abs(dot(normalize(vNormalV), v)), 3.0);
          col += vec3(0.32, 0.4, 0.55) * fres * 0.35;

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
  }, []);

  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    if (mesh.current) mesh.current.visible = live.viewBlend > 0.9;
  });

  return (
    <mesh ref={mesh} position-y={GLOBE.centerY} material={material} visible={false} renderOrder={-1}>
      <sphereGeometry args={[GLOBE.radius - 0.004, 64, 32]} />
    </mesh>
  );
}
