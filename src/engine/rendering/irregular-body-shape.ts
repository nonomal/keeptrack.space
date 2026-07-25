/**
 * Procedural shape model for small irregular bodies (Phobos, Deimos).
 *
 * A UV sphere is useless for a 13 x 11 x 9 km rubble pile: the silhouette is the whole
 * point of these moons. This builds the surface as a radius field over the sphere -
 * triaxial ellipsoid, minus named crater bowls, plus fractal roughness - and evaluates it
 * on the same lat/lon grid `SphereGeometry` uses, so the equirectangular texture maps
 * exactly as it does on every other body.
 *
 * Deliberately GL-free so `scripts/mars-moons/export-moon-mesh.ts` can emit the identical
 * surface as an OBJ for inspection in the mesh viewer. The noise is a seeded integer hash,
 * so the runtime geometry and the exported file agree vertex for vertex.
 */

export interface CraterSpec {
  /** Body-fixed latitude of the crater center, degrees. */
  latDeg: number;
  /**
   * Body-fixed longitude of the crater center, degrees east, measured from the prime
   * meridian (the +X axis, which for a tidally locked moon points at its planet).
   */
  lonDeg: number;
  /** Angular radius of the crater as seen from the body center, degrees. */
  angularRadiusDeg: number;
  /** Floor depth below the undisturbed surface, km. */
  depthKm: number;
  /** Height of the raised rim above the undisturbed surface, km. */
  rimHeightKm: number;
}

export interface IrregularBodyShape {
  /** Semi-axes along body +X (planet-facing), +Y (along-track) and +Z (north), km. */
  semiAxesKm: [number, number, number];
  craters: CraterSpec[];
  /** Peak-to-peak amplitude of the fractal roughness, km. */
  roughnessKm: number;
  /** Angular size of the largest roughness lobe: lower is lumpier. */
  roughnessFrequency: number;
  /** Integer seed for the roughness hash. */
  seed: number;
}

export interface SurfaceArrays {
  /** Interleaved position(3) / normal(3) / uv(2), matching SphereGeometry's layout. */
  combined: number[];
  indices: number[];
  positions: Float32Array;
  /** Largest vertex radius, km - the render-time bounding radius. */
  maxRadiusKm: number;
}

const DEG2RAD = Math.PI / 180;

/** Deterministic hash to a [-1, 1] gradient-ish value for a lattice point. */
function hashLattice(ix: number, iy: number, iz: number, seed: number): number {
  let h = Math.trunc(ix) * 374761393 + Math.trunc(iy) * 668265263 + Math.trunc(iz) * 2147483647 + seed * 1274126177;

  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;

  return (h & 0xffff) / 0x8000 - 1;
}

/** Trilinear value noise over a 3D lattice. Smooth enough at these amplitudes. */
function valueNoise3d(x: number, y: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  // Smoothstep the fractions so octaves do not show the lattice.
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const c00 = lerp(hashLattice(ix, iy, iz, seed), hashLattice(ix + 1, iy, iz, seed), sx);
  const c10 = lerp(hashLattice(ix, iy + 1, iz, seed), hashLattice(ix + 1, iy + 1, iz, seed), sx);
  const c01 = lerp(hashLattice(ix, iy, iz + 1, seed), hashLattice(ix + 1, iy, iz + 1, seed), sx);
  const c11 = lerp(hashLattice(ix, iy + 1, iz + 1, seed), hashLattice(ix + 1, iy + 1, iz + 1, seed), sx);

  return lerp(lerp(c00, c10, sy), lerp(c01, c11, sy), sz);
}

/** Four-octave fractal noise sampled on the unit direction, so it wraps seamlessly. */
function fractalNoise(direction: readonly [number, number, number], frequency: number, seed: number): number {
  const [nx, ny, nz] = direction;
  let amplitude = 1;
  let freq = frequency;
  let sum = 0;
  let norm = 0;

  for (let octave = 0; octave < 4; octave++) {
    sum += amplitude * valueNoise3d(nx * freq, ny * freq, nz * freq, seed + octave * 7919);
    norm += amplitude;
    amplitude *= 0.5;
    freq *= 2.1;
  }

  return sum / norm;
}

/**
 * Crater profile as a function of normalized distance from the center: a parabolic bowl
 * inside the rim, a raised rim ring, and nothing past it. Returns a radial offset in km
 * (negative digs in).
 */
function craterProfile(t: number, crater: CraterSpec): number {
  if (t >= 1.35) {
    return 0;
  }

  if (t <= 1) {
    // Bowl floor, easing out to zero exactly at the rim crest.
    const bowl = -crater.depthKm * (1 - t * t);
    const rim = crater.rimHeightKm * Math.exp(-(((t - 1) / 0.22) ** 2));

    return bowl + rim;
  }

  // Ejecta shoulder outside the rim, decaying to zero.
  return crater.rimHeightKm * Math.exp(-(((t - 1) / 0.22) ** 2));
}

/** Radius of the shape along a unit direction, km. */
export function shapeRadius(shape: IrregularBodyShape, nx: number, ny: number, nz: number): number {
  const [ax, ay, az] = shape.semiAxesKm;
  // Triaxial ellipsoid radius along this direction.
  let radius = 1 / Math.hypot(nx / ax, ny / ay, nz / az);

  for (const crater of shape.craters) {
    const lat = crater.latDeg * DEG2RAD;
    const lon = crater.lonDeg * DEG2RAD;
    const cx = Math.cos(lat) * Math.cos(lon);
    const cy = Math.cos(lat) * Math.sin(lon);
    const cz = Math.sin(lat);
    const cosPsi = Math.min(1, Math.max(-1, nx * cx + ny * cy + nz * cz));
    const psi = Math.acos(cosPsi);
    const t = psi / (crater.angularRadiusDeg * DEG2RAD);

    radius += craterProfile(t, crater);
  }

  radius += shape.roughnessKm * fractalNoise([nx, ny, nz], shape.roughnessFrequency, shape.seed);

  return radius;
}

/** Surface point for a lat/lon on the shape. */
function surfacePoint(shape: IrregularBodyShape, theta: number, phi: number): [number, number, number] {
  const cosTheta = Math.cos(theta);
  const nx = cosTheta * Math.cos(phi);
  const ny = cosTheta * Math.sin(phi);
  const nz = Math.sin(theta);
  const radius = shapeRadius(shape, nx, ny, nz);

  return [nx * radius, ny * radius, nz * radius];
}

/**
 * Tessellate the shape on SphereGeometry's grid.
 *
 * Normals come from central differences of the surface itself rather than accumulated
 * face normals: the lat/lon parameterization duplicates the seam column and both poles,
 * and averaging faces there leaves a visible lighting crease straight down the body.
 */
export function buildIrregularSurface(shape: IrregularBodyShape, widthSegments: number, heightSegments: number): SurfaceArrays {
  const combined: number[] = [];
  const indices: number[] = [];
  const positions = new Float32Array((widthSegments + 1) * (heightSegments + 1) * 3);
  let maxRadiusKm = 0;
  let vertexIdx = 0;

  // Differencing step: a fraction of a cell, small enough to track the crater rims.
  const dTheta = Math.PI / heightSegments / 8;
  const dPhi = (Math.PI * 2) / widthSegments / 8;

  for (let heightSegment = 0; heightSegment <= heightSegments; heightSegment++) {
    // Matches SphereGeometry: theta sweeps -PI/2 (south pole) to +PI/2 (north pole).
    const theta = (Math.PI / heightSegments) * heightSegment - Math.PI / 2;

    for (let widthSegment = 0; widthSegment <= widthSegments; widthSegment++) {
      const phi = ((Math.PI * 2) / widthSegments) * widthSegment;
      const point = surfacePoint(shape, theta, phi);

      // Tangents along +phi and +theta, clamped away from the poles where d/dphi vanishes.
      const thetaSafe = Math.min(Math.PI / 2 - dTheta, Math.max(-Math.PI / 2 + dTheta, theta));
      const east = surfacePoint(shape, thetaSafe, phi + dPhi);
      const west = surfacePoint(shape, thetaSafe, phi - dPhi);
      const north = surfacePoint(shape, thetaSafe + dTheta, phi);
      const south = surfacePoint(shape, thetaSafe - dTheta, phi);
      const tEast: [number, number, number] = [east[0] - west[0], east[1] - west[1], east[2] - west[2]];
      const tNorth: [number, number, number] = [north[0] - south[0], north[1] - south[1], north[2] - south[2]];
      let normal: [number, number, number] = [
        tEast[1] * tNorth[2] - tEast[2] * tNorth[1],
        tEast[2] * tNorth[0] - tEast[0] * tNorth[2],
        tEast[0] * tNorth[1] - tEast[1] * tNorth[0],
      ];
      const normalLength = Math.hypot(normal[0], normal[1], normal[2]);

      if (normalLength > 1e-9) {
        normal = [normal[0] / normalLength, normal[1] / normalLength, normal[2] / normalLength];
      } else {
        const pointLength = Math.hypot(point[0], point[1], point[2]) || 1;

        normal = [point[0] / pointLength, point[1] / pointLength, point[2] / pointLength];
      }

      const v = 1 - heightSegment / heightSegments;
      const u = 0.5 + widthSegment / widthSegments;

      combined.push(point[0], point[1], point[2], normal[0], normal[1], normal[2], u, v);
      positions[vertexIdx * 3] = point[0];
      positions[vertexIdx * 3 + 1] = point[1];
      positions[vertexIdx * 3 + 2] = point[2];
      vertexIdx++;
      maxRadiusKm = Math.max(maxRadiusKm, Math.hypot(point[0], point[1], point[2]));
    }
  }

  for (let heightSegment = 0; heightSegment < heightSegments; heightSegment++) {
    for (let widthSegment = 0; widthSegment < widthSegments; widthSegment++) {
      const blVert = heightSegment * (widthSegments + 1) + widthSegment;
      const brVert = blVert + 1;
      const tlVert = (heightSegment + 1) * (widthSegments + 1) + widthSegment;
      const trVert = tlVert + 1;

      indices.push(blVert, brVert, tlVert, tlVert, trVert, brVert);
    }
  }

  return { combined, indices, positions, maxRadiusKm };
}
