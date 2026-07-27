import { BufferAttribute } from './buffer-attribute';
import { BufferGeometry, GeometryParams } from './buffer-geometry';
import { buildIrregularSurface, IrregularBodyShape } from './irregular-body-shape';

interface IrregularBodyGeometryParams extends GeometryParams {
  shape: IrregularBodyShape;
  widthSegments: number;
  heightSegments: number;
}

/**
 * `SphereGeometry`'s drop-in twin for small irregular bodies: identical attribute layout,
 * winding and UV convention, but the vertex radii come from a procedural shape model
 * instead of a constant. See {@link IrregularBodyShape}.
 */
export class IrregularBodyGeometry extends BufferGeometry {
  readonly shape: IrregularBodyShape;
  readonly widthSegments: number;
  readonly heightSegments: number;
  /** Largest vertex radius, km. Used as the body's effective bounding radius. */
  readonly maxRadiusKm: number;

  private readonly vertices_: Float32Array;

  constructor(gl: WebGL2RenderingContext, { shape, widthSegments, heightSegments, attributes = {} }: IrregularBodyGeometryParams) {
    super({
      type: 'IrregularBodyGeometry',
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
    this.shape = shape;
    this.widthSegments = widthSegments;
    this.heightSegments = heightSegments;

    const surface = buildIrregularSurface(shape, widthSegments, heightSegments);

    this.vertices_ = surface.positions;
    this.maxRadiusKm = surface.maxRadiusKm;

    this.setCombinedBuffer(gl, surface.combined);
    this.setIndex(gl, surface.indices);
  }

  /** Vertex positions, km, body-fixed. */
  getVertices(): Float32Array {
    return this.vertices_;
  }
}
