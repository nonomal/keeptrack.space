import { SettingsManager } from '../../settings/settings';
import { glsl } from '../utils/development/formatter';
import { DepthManager } from './depth-manager';

/**
 * Rendering style for the core satellite dot, selected live via the
 * `u_dotStyle` uniform (settingsManager.satShader.dotStyle).
 */
export enum DotStyle {
  /** Legacy soft-edged glow (default) */
  SoftGlow = 0,
  /** Crisp anti-aliased solid disc */
  Disc = 1,
  /** Hollow ring / donut */
  Ring = 2,
  /** Diamond (rotated square) */
  Diamond = 3,
  /** Axis-aligned square */
  Square = 4,
}

/**
 * Per-dot status codes stored in the DotsManager size buffer (Int8Array).
 * The vertex shaders only care that any status >= 0.5 renders at star size
 * (so all legacy `a_size >= 0.5` checks keep working); the fragment shaders
 * use the exact code to draw identification markers around the dot.
 */
export enum DotStatus {
  /** Regular dot, distance-based sizing */
  None = 0,
  /** Plain big dot (planets) - no marker */
  Big = 1,
  /** Search result / current group member - thin ring */
  Searched = 2,
  /** Currently selected object - reticle */
  Selected = 3,
  /** Currently hovered object - halo */
  Hover = 4,
}

/**
 * Shared GLSL library for dot core styles and status identification markers.
 * Interpolated into both the base dots fragment shader and the pro symbology
 * fragment shader so the two can never drift apart. Every function returns a
 * 0..1 coverage value; callers multiply by vColor.a and never discard.
 */
export const createDotStyleGlsl = (settings: SettingsManager): string => glsl`
    // Anti-aliasing half-width: ~1 screen pixel in sprite-normalized units
    float ktAa(float pointSize) {
      return clamp(2.0 / max(pointSize, 1.0), 0.02, 0.3);
    }

    // Legacy soft-glow falloff
    float ktSoftAlpha(vec2 p) {
      float r = (${settings.satShader.blurFactor1} - min(abs(length(p)), 1.0));
      return clamp(2.0 * r + ${settings.satShader.blurFactor2}, 0.0, 1.0);
    }

    float ktDiscAlpha(vec2 p, float radius, float aa) {
      return 1.0 - smoothstep(radius - aa, radius + aa, length(p));
    }

    float ktRingAlpha(vec2 p, float radius, float halfWidth, float aa) {
      float d = abs(length(p) - radius) - halfWidth;
      return 1.0 - smoothstep(-aa, aa, d);
    }

    float ktDiamondAlpha(vec2 p, float size, float aa) {
      float d = (abs(p.x) + abs(p.y)) - size;
      return 1.0 - smoothstep(-aa, aa, d);
    }

    float ktSquareAlpha(vec2 p, float size, float aa) {
      vec2 d2 = abs(p) - vec2(size);
      float d = max(d2.x, d2.y);
      return 1.0 - smoothstep(-aa, aa, d);
    }

    // Bold "ringed planet" glyph: opaque disc + tilted elliptical ring. Reads
    // as a planet at a glance and is distinct from the satellite dot styles,
    // the soft-glow stars, and the status markers. Returns 0..1 coverage; the
    // ring's "ears" extend past the disc left/right like the classic Saturn icon.
    float ktPlanetAlpha(vec2 p, float scale, float pointSize) {
      float aa = ktAa(pointSize);
      float disc = ktDiscAlpha(p, 0.5 * scale, aa);

      // Rotate 30 degrees, then squash y 3x so the ring becomes an ellipse
      // whose ears reach past the disc while its minor axis hides behind it
      float c = 0.8660254;
      float s = 0.5;
      vec2 q = vec2(c * p.x - s * p.y, (s * p.x + c * p.y) * 3.0);
      // Stretched-space distance overestimates near the minor axis, so widen
      // the AA window (2x) as a compromise between the 1x and 3x gradients
      float ring = 1.0 - smoothstep(-2.0 * aa, 2.0 * aa, abs(length(q) - 0.86 * scale) - 0.09 * scale);

      return max(disc, ring);
    }

    // Core dot coverage for the active style. scale < 1 shrinks the core to
    // leave room for a status marker band around it.
    float ktShapeAlpha(int style, vec2 p, float scale, float pointSize) {
      float aa = ktAa(pointSize);

      if (style == ${DotStyle.Disc}) {
        return ktDiscAlpha(p, 0.85 * scale, aa);
      } else if (style == ${DotStyle.Ring}) {
        return ktRingAlpha(p, 0.62 * scale, 0.17 * scale, aa);
      } else if (style == ${DotStyle.Diamond}) {
        return ktDiamondAlpha(p, 0.9 * scale, aa);
      } else if (style == ${DotStyle.Square}) {
        return ktSquareAlpha(p, 0.68 * scale, aa);
      }

      return ktSoftAlpha(p / max(scale, 0.001));
    }

    // Identification marker coverage for a status code (see DotStatus in TS):
    // searched -> thin ring, selected -> reticle (ring + cardinal ticks),
    // hover -> soft halo. Statuses None/Big return 0.
    float ktMarkerAlpha(float status, vec2 p, float pointSize) {
      float aa = ktAa(pointSize);

      if (status > ${DotStatus.Hover - 0.5}) {
        float d = abs(length(p) - 0.78);
        return (1.0 - smoothstep(0.0, 0.3, d)) * 0.85;
      } else if (status > ${DotStatus.Selected - 0.5}) {
        float ring = ktRingAlpha(p, 0.82, 0.05, aa);
        vec2 a = abs(p);
        float tickX = (1.0 - smoothstep(0.08 - aa, 0.08 + aa, a.y)) * step(0.6, a.x);
        float tickY = (1.0 - smoothstep(0.08 - aa, 0.08 + aa, a.x)) * step(0.6, a.y);
        return max(ring, max(tickX, tickY));
      } else if (status > ${DotStatus.Searched - 0.5}) {
        return ktRingAlpha(p, 0.84, 0.05, aa);
      }

      return 0.0;
    }
    `;

export const createBaseFragShader = (settings: SettingsManager): string => glsl`#version 300 es
    precision highp float;

    uniform int u_dotStyle;
    uniform bool u_statusMarkers;

    in vec4 vColor;
    in float vSize;
    in float vDist;
    in float vPointSize;
    in float vIsPlanet;

    out vec4 fragColor;

    ${createDotStyleGlsl(settings)}

    void main(void) {
      vec2 ptCoord = gl_PointCoord * 2.0 - vec2(1.0, 1.0);

      // Stars always keep the soft-glow look regardless of dot style. Outer
      // planets also sit beyond 1e8 km, so exclude planets explicitly or
      // Jupiter+ render as stars and lose their glyph and status markers.
      bool isStar = vDist > 1.0e8 && vIsPlanet < 0.5;

      // vSize carries the per-dot status code (see DotStatus); markers only
      // exist for statuses above Big so planets stay plain
      float status = (u_statusMarkers && !isStar) ? vSize : 0.0;
      float hasMarker = step(${DotStatus.Big + 0.5}, status);

      // Shrink the core dot when a marker band is drawn around it
      float coreScale = mix(1.0, 0.55, hasMarker);
      float core;

      if (vIsPlanet > 0.5) {
        core = ktPlanetAlpha(ptCoord, coreScale, vPointSize);
      } else {
        core = isStar ? ktSoftAlpha(ptCoord) : ktShapeAlpha(u_dotStyle, ptCoord, coreScale, vPointSize);
      }
      float marker = hasMarker * ktMarkerAlpha(status, ptCoord, vPointSize);

      // Marker composites on top: white for rings/reticle, dot-tinted for the
      // hover halo. Clamp (not just min) so edge fragments land at exactly 0,
      // never negative: with standard src-alpha blending an alpha-0 fragment is
      // a true no-op, which is visually identical to the old discard but keeps
      // early-Z enabled for the whole draw, so the ~half of the catalog behind
      // the Earth is rejected before fragment shading (a discard anywhere in
      // the shader disables early-Z).
      vec3 markerColor = status > ${DotStatus.Hover - 0.5} ? vColor.rgb : vec3(1.0);
      vec3 rgb = mix(vColor.rgb, markerColor, marker);
      float alpha = clamp(max(core, marker), 0.0, 1.0);

      fragColor = vec4(rgb, vColor.a * alpha);
    }
    `;

export const createBaseVertShader = (settings: SettingsManager): string => glsl`#version 300 es
    precision highp float;
    in vec3 a_position;
    in vec4 a_color;
    in float a_size;

    uniform float u_minSize;
    uniform float u_maxSize;
    uniform float u_starMinSize;
    uniform vec3 worldOffset;
    uniform mat4 u_pMvCamMatrix;
    uniform float logDepthBufFC;
    uniform bool u_flatMapMode;
    uniform float u_gmst;
    uniform float u_currentGmst;
    uniform float u_earthRadius;
    uniform float u_flatMapCenterX;
    uniform float u_flatMapZoom;
    uniform bool u_polarViewMode;
    uniform vec3 u_sensorEcef;
    uniform mat3 u_ecefToEnu;
    uniform float u_polarRadius;
    uniform float u_polarZoom;
    uniform vec3 u_camPos;
    uniform int u_starIdx1;
    uniform int u_starIdx2;
    uniform int u_planetIdx1;
    uniform int u_planetIdx2;

    out vec4 vColor;
    out float vSize;
    out float vDist;
    out float vPointSize;
    out float vIsPlanet;

    float when_lt(float x, float y) {
        return max(sign(y - x), 0.0);
    }
    float when_ge(float x, float y) {
        return 1.0 - when_lt(x, y);
    }

    void main(void) {
        // True planets/dwarf planets get a dedicated glyph and a size boost;
        // set first so every early-return path leaves the varying defined
        float isPlanet = (gl_VertexID >= u_planetIdx1 && gl_VertexID <= u_planetIdx2) ? 1.0 : 0.0;

        vIsPlanet = isPlanet;

        // Skip objects with invalid positions:
        // - NaN from failed propagation (NaN comparisons always false)
        // - Positions inside Earth (< 100 km from center)
        // Planet dots are exempt from the near-origin cull: Earth's own planet
        // dot legitimately sits AT the ECI origin (Earth-centered frame), and
        // in planet-centered views the worldOffset moves it on-screen. The pro
        // symbology shader has no such cull, so this keeps the builds in parity.
        float posLen = length(a_position);
        if ((posLen < 100.0 && isPlanet < 0.5) || posLen != posLen) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            gl_PointSize = 0.0;
            vColor = vec4(0.0);
            vSize = 0.0;
            vDist = 0.0;
            vPointSize = 0.0;
            return;
        }

        vec3 eciPos = a_position + worldOffset;
        vec4 position;

        if (u_flatMapMode) {
            float PI = 3.14159265359;
            float eciDist = length(eciPos);

            // Filter out stars and distant objects
            if (eciDist > 1.0e7) {
                gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
                gl_PointSize = 0.0;
                vColor = vec4(0.0);
                vSize = 0.0;
                vDist = eciDist;
                vPointSize = 0.0;
                return;
            }

            float lon = atan(eciPos.y, eciPos.x) - u_gmst;
            lon = mod(lon + PI, 2.0 * PI) - PI;
            float lat = atan(eciPos.z, length(eciPos.xy));
            float alt = eciDist - u_earthRadius;
            vec3 flatPos = vec3(lon * u_earthRadius, lat * u_earthRadius, alt * 0.001);

            // Wrap X to nearest copy of camera center for seamless scrolling
            float mapW = 2.0 * PI * u_earthRadius;
            flatPos.x = u_flatMapCenterX + mod(flatPos.x - u_flatMapCenterX + mapW * 0.5, mapW) - mapW * 0.5;

            position = u_pMvCamMatrix * vec4(flatPos, 1.0);
        } else if (u_polarViewMode) {
            float PI = 3.14159265359;
            float eciDist = length(eciPos);

            if (eciDist > 1.0e7) {
                gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
                gl_PointSize = 0.0;
                vColor = vec4(0.0);
                vSize = 0.0;
                vDist = eciDist;
                vPointSize = 0.0;
                return;
            }

            // ECI to ECEF — use u_currentGmst (main-thread, frame-accurate)
            // instead of u_gmst (from cruncher worker, may lag during rapid time changes)
            float cg = cos(u_currentGmst);
            float sg = sin(u_currentGmst);
            vec3 ecef = vec3(
                eciPos.x * cg + eciPos.y * sg,
               -eciPos.x * sg + eciPos.y * cg,
                eciPos.z
            );

            // ECEF to ENU (sensor-relative)
            vec3 d = ecef - u_sensorEcef;
            vec3 enu = u_ecefToEnu * d;

            // ENU to azimuth/elevation
            float az = atan(enu.x, enu.y);
            float el = atan(enu.z, length(enu.xy));

            // Cull below-horizon satellites
            if (el < 0.0) {
                gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
                gl_PointSize = 0.0;
                vColor = vec4(0.0);
                vSize = 0.0;
                vDist = eciDist;
                vPointSize = 0.0;
                return;
            }

            // Polar projection: zenith at center, horizon at edge
            float r = (PI / 2.0 - el) / (PI / 2.0);
            vec3 polarPos = vec3(
                r * sin(az) * u_polarRadius,
                r * cos(az) * u_polarRadius,
                0.0
            );

            position = u_pMvCamMatrix * vec4(polarPos, 1.0);
        } else {
            // Rotate stale ground-object ECI positions to match current Earth rotation
            float groundDist = length(a_position.xyz);
            if (groundDist < 6421.0) {
                float deltaGmst = u_currentGmst - u_gmst;
                float cosD = cos(deltaGmst);
                float sinD = sin(deltaGmst);
                eciPos = vec3(
                    a_position.x * cosD - a_position.y * sinD + worldOffset.x,
                    a_position.x * sinD + a_position.y * cosD + worldOffset.y,
                    a_position.z + worldOffset.z
                );
            }
            // Stars are fixed directions on the celestial sphere, not positions:
            // re-anchor the star shell to the camera so it never parallaxes. The
            // shell sits a fixed 3e10 km from the ECI origin, so without this the
            // camera can pass outside it when parked at a deep-space probe like
            // Voyager 1 (~2.5e10 km out). Must match the picking shader.
            if (gl_VertexID >= u_starIdx1 && gl_VertexID <= u_starIdx2) {
                eciPos = a_position + u_camPos;
            }
            // Pull the dot toward the camera (fraction of range, capped) so the
            // Earth sphere cannot slice through the screen-facing sprite when a
            // dot sits on or just above the surface. Ray-aligned: no parallax
            // shift, only the depth changes. The cap keeps the pull from growing
            // with zoom-out and dragging back-of-Earth dots through the limb.
            // Must match the picking shader.
            vec3 toCam = u_camPos - eciPos;
            float pullDist = min(length(toCam) * ${settings.satShader.depthPullFactor}, float(${settings.satShader.depthPullMaxKm}));
            eciPos += normalize(toCam) * pullDist;
            position = u_pMvCamMatrix * vec4(eciPos, 1.0);
        }

        gl_Position = position;

        ${DepthManager.getLogDepthVertCode()}

        float dist = distance(vec3(0.0, 0.0, 0.0), a_position.xyz);

        if (u_flatMapMode) {
          // Large dots (searched/selected, a_size>=0.5) shrink when zoomed in so they don't obscure the map
          // Small dots (regular satellites) keep a fixed minimum size
          float isBig = step(0.5, a_size);
          float bigSize = float(${settings.satShader.starSize}) / sqrt(u_flatMapZoom);
          float flatSize = mix(u_minSize, max(bigSize, 3.0), isBig);
          gl_PointSize = max(flatSize, 1.0);
          vPointSize = gl_PointSize;
          vColor = a_color;
          vSize = a_size * 1.0;
          vDist = dist;
          return;
        }

        if (u_polarViewMode) {
          float zoomScale = sqrt(u_polarZoom);
          float polarSize = mix(u_minSize, float(${settings.satShader.starSize}), step(0.5, a_size));
          gl_PointSize = polarSize * zoomScale;
          vPointSize = gl_PointSize;
          vColor = a_color;
          vSize = a_size * 1.0;
          vDist = dist;
          return;
        }

        float drawSize = 0.0;
        float baseSize = pow(${settings.satShader.distanceBeforeGrow} \/ position.z, 2.1);

        // Use star min size for objects beyond 1e8 km (stars), regular min size for satellites
        float effectiveMinSize = mix(u_minSize, u_starMinSize, step(1.0e8, dist));

        // Satellite / Star
        drawSize +=
        when_lt(a_size, 0.5) *
        (min(max(baseSize, effectiveMinSize), u_maxSize) * 1.0);

        // Something on the ground
        drawSize +=
        when_lt(a_size, 0.5) * when_lt(dist, 6421.0) *
        (min(max(baseSize, u_minSize * 0.5), u_maxSize) * 1.0);

        // Searched Object
        drawSize += when_ge(a_size, 0.5) * ${settings.satShader.starSize};

        // Planets render a bolder glyph, so give the sprite room to draw it
        drawSize *= 1.0 + 0.4 * isPlanet;

        gl_PointSize = drawSize;
        vPointSize = gl_PointSize;
        vColor = a_color;
        vSize = a_size * 1.0;
        vDist = dist;
    }
    `;
