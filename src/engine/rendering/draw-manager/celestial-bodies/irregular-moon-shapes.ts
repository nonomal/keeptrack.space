/**
 * Procedural shape models for Phobos and Deimos.
 *
 * Kept apart from the body classes (which pull in settings and GL) so a plain-Node exporter
 * can import them and emit the identical surface as an OBJ. See {@link IrregularBodyShape}
 * for how the fields combine.
 */

import { IrregularBodyShape } from '@app/engine/rendering/irregular-body-shape';

/**
 * Semi-axes are Phobos's measured 27 x 22 x 18 km triaxial fit, oriented the way a tidally
 * locked body sits: the long axis points at Mars.
 *
 * Stickney dominates the silhouette - a 9 km crater on an 11 km body - so it is modelled
 * explicitly at its IAU location rather than left to the noise. `lonDeg` is east longitude
 * from the sub-Mars meridian, so Stickney's traditional 49 W is 311 E.
 */
export const PHOBOS_SHAPE: IrregularBodyShape = {
  semiAxesKm: [13.0, 11.4, 9.1],
  craters: [
    // Stickney.
    { latDeg: 1, lonDeg: 311, angularRadiusDeg: 24, depthKm: 1.9, rimHeightKm: 0.35 },
    // Hall.
    { latDeg: -80, lonDeg: 150, angularRadiusDeg: 14, depthKm: 0.9, rimHeightKm: 0.15 },
    // Roche.
    { latDeg: 53, lonDeg: 183, angularRadiusDeg: 12, depthKm: 0.8, rimHeightKm: 0.12 },
    // Sharpless.
    { latDeg: -27, lonDeg: 206, angularRadiusDeg: 8, depthKm: 0.5, rimHeightKm: 0.1 },
    // Limtoc.
    { latDeg: -11, lonDeg: 306, angularRadiusDeg: 6, depthKm: 0.35, rimHeightKm: 0.08 },
  ],
  roughnessKm: 0.45,
  roughnessFrequency: 2.6,
  seed: 19_770_712,
};

/**
 * Deimos's measured 15 x 12.2 x 10.4 km triaxial fit.
 *
 * It reads much smoother than Phobos because a thick regolith blanket has filled in its
 * craters, so the roughness is halved and only its two named craters are cut in - both as
 * shallow saucers rather than Stickney-style bowls.
 */
export const DEIMOS_SHAPE: IrregularBodyShape = {
  semiAxesKm: [7.5, 6.1, 5.2],
  craters: [
    // Voltaire.
    { latDeg: 22, lonDeg: 356, angularRadiusDeg: 15, depthKm: 0.45, rimHeightKm: 0.06 },
    // Swift.
    { latDeg: -12, lonDeg: 4, angularRadiusDeg: 11, depthKm: 0.35, rimHeightKm: 0.05 },
  ],
  roughnessKm: 0.22,
  roughnessFrequency: 2.2,
  seed: 18_770_812,
};
