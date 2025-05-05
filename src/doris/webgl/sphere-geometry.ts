import { BufferAttribute } from './buffer-attribute';
import { BufferGeometry, GeometryParams } from './buffer-geometry';

interface SphereGeometryParams extends GeometryParams {
  radius: number;
  widthSegments: number;
  heightSegments: number;
  isSkipTexture?: boolean;
  phiStart?: number;
  phiLength?: number;
  thetaStart?: number;
  thetaLength?: number;
}

export class SphereGeometry extends BufferGeometry {
  /**
   * Sphere radius. Expects a `Float`. Default `1`
   */
  radius: number;
  /**
   * widthSegments Number of horizontal segments. Minimum value is 3, and the Expects a `Integer`. Default `32`
   */
  widthSegments: number;
  /**
   * heightSegments Number of vertical segments. Minimum value is 2, and the Expects a `Integer`. Default `16`
   */
  heightSegments: number;
  /**
   * Some objects don't need texture mapping
   */
  isSkipTexture: boolean;
  /**
   * phiStart Specify horizontal starting angle. Expects a `Float`. Default `0`
   */
  phiStart: number;
  /**
   * phiLength Specify horizontal sweep angle size. Expects a `Float`. Default `Math.PI * 2`
   */
  phiLength: number;
  /**
   * thetaStart Specify vertical starting angle. Expects a `Float`. Default `0`
   */
  thetaStart: number;
  /**
   * thetaLength Specify vertical sweep angle size. Expects a `Float`. Default `Math.PI`
   */
  thetaLength: number;

  /**
   * Create a new instance of {@link SphereGeometry}
   * @remarks
   * The geometry is created by sweeping and calculating vertexes
   * around the **Y** axis (horizontal sweep) and the **Z** axis (vertical sweep)
   * Thus, incomplete spheres (akin to `'sphere slices'`) can be created
   * through the use of different values of {@link phiStart}, {@link phiLength}, {@link thetaStart} and {@link thetaLength},
   * in order to define the points in which we start (or end) calculating those vertices.
   * @param radius Sphere radius. Expects a `Float`. Default `1`
   * @param widthSegments Number of horizontal segments. Minimum value is 3, and the Expects a `Integer`. Default `32`
   * @param heightSegments Number of vertical segments. Minimum value is 2, and the Expects a `Integer`. Default `16`
   * @param phiStart Specify horizontal starting angle. Expects a `Float`. Default `0`
   * @param phiLength Specify horizontal sweep angle size. Expects a `Float`. Default `Math.PI * 2`
   * @param thetaStart Specify vertical starting angle. Expects a `Float`. Default `0`
   * @param thetaLength Specify vertical sweep angle size. Expects a `Float`. Default `Math.PI`
   */
  constructor(
    gl: WebGL2RenderingContext,
    {
      radius,
      widthSegments,
      heightSegments,
      attributes = {},
      isSkipTexture = false,
      phiStart = 0,
      phiLength = Math.PI * 2,
      thetaStart = 0,
      thetaLength = Math.PI,
    }: SphereGeometryParams,
  ) {
    super({
      type: 'SphereGeometry',
      attributes: {
        ...{
          position: new BufferAttribute({
            location: 0,
            vertices: 3,
            stride: Float32Array.BYTES_PER_ELEMENT * 8,
            offset: 0,
          }),
          normal: new BufferAttribute({
            location: 1,
            vertices: 3,
            stride: Float32Array.BYTES_PER_ELEMENT * 8,
            offset: Float32Array.BYTES_PER_ELEMENT * 3,
          }),
          uv: new BufferAttribute({
            location: 2,
            vertices: 2,
            stride: Float32Array.BYTES_PER_ELEMENT * 8,
            offset: Float32Array.BYTES_PER_ELEMENT * 6,
          }),
          ...attributes,
        },
      },
    });
    this.gl = gl;
    this.radius = radius;
    this.widthSegments = widthSegments;
    this.heightSegments = heightSegments;
    this.isSkipTexture = isSkipTexture;
    this.phiStart = phiStart;
    this.phiLength = phiLength;
    this.thetaStart = thetaStart;
    this.thetaLength = thetaLength;

    this.calculateCombinedArray(isSkipTexture);
    this.calculateVertIndicies_();
  }

  /**
   * Generate a uvsphere bottom up, CCW order
   */
  private calculateCombinedArray(isSkipTexture: boolean) {
    const combinedArray = [] as number[];

    for (let heightSegment = 0; heightSegment <= this.heightSegments; heightSegment++) {
      const theta = this.thetaStart + ((this.thetaStart + this.thetaLength) / this.heightSegments) * heightSegment - Math.PI / 2;

      if (theta > this.thetaStart + this.thetaLength) {
        continue;
      }

      const diskRadius = Math.cos(Math.abs(theta));
      const z = Math.sin(theta);

      for (let widthSegment = 0; widthSegment <= this.widthSegments; widthSegment++) {
        // add an extra vertex for texture funness
        const phi = this.phiStart + ((this.phiStart + this.phiLength) / this.widthSegments) * widthSegment;

        if (phi > this.phiStart + this.phiLength) {
          continue;
        }

        const x = Math.cos(phi) * diskRadius;
        const y = Math.sin(phi) * diskRadius;
        /*
         * console.log('i: ' + i + '    LON: ' + lonAngle * RAD2DEG + ' X: ' + x + ' Y: ' + y)
         * mercator cylindrical projection (simple angle interpolation)
         */
        const v = 1 - heightSegment / this.heightSegments;
        const u = 0.5 + widthSegment / this.widthSegments; // may need to change to move map

        /*
         * console.log('u: ' + u + ' v: ' + v);
         * normals: should just be a vector from center to point (aka the point itself!
         */
        combinedArray.push(x * this.radius);
        combinedArray.push(y * this.radius);
        combinedArray.push(z * this.radius);
        combinedArray.push(x);
        combinedArray.push(y);
        combinedArray.push(z);

        // Some objects don't need texture mapping
        if (!isSkipTexture) {
          combinedArray.push(u);
          combinedArray.push(v);
        }
      }
    }

    this.setCombinedBuffer(this.gl, combinedArray);
  }

  /**
   * Calculate the vertex draw order for the sphere
   */
  private calculateVertIndicies_() {
    const index = [] as number[];

    for (let heightSegment = 0; heightSegment < this.heightSegments; heightSegment++) {
      // this is for each QUAD, not each vertex, so <
      for (let widthSegment = 0; widthSegment < this.widthSegments; widthSegment++) {
        const blVert = heightSegment * (this.widthSegments + 1) + widthSegment; // there's this.widthSegments + 1 verts in each horizontal band
        const brVert = blVert + 1;
        const tlVert = (heightSegment + 1) * (this.widthSegments + 1) + widthSegment;
        const trVert = tlVert + 1;

        /*
         * DEBUG:
         * console.log('bl: ' + blVert + ' br: ' + brVert +  ' tl: ' + tlVert + ' tr: ' + trVert);
         */
        index.push(blVert);
        index.push(brVert);
        index.push(tlVert);

        index.push(tlVert);
        index.push(trVert);
        index.push(brVert);
      }
    }

    this.setIndex(this.gl, index);
  }
}
