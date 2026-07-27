/* eslint-disable camelcase */

import { ServiceLocator } from '@app/engine/core/service-locator';
import { vec3, vec4 } from 'gl-matrix';
import { GlUtils } from '../gl-utils';
import { LineManager } from '../line-manager';

export type LineColor = (typeof LineColors)[keyof typeof LineColors] | vec4;

/**
 * A UI-facing summary of a line. The engine stays locale-free: `kind` is a stable
 * key that the UI maps to a localized label, and `detail` is optional human context
 * (a satellite name, an axis, etc.). Lines that share a `kind` + `detail` are grouped
 * together in the line-management UI.
 */
export interface LineDescription {
  kind: string;
  detail?: string;
}

export const LineColors = {
  RED: [1.0, 0.0, 0.0, 1.0] as vec4,
  ORANGE: [1.0, 0.5, 0.0, 1.0] as vec4,
  YELLOW: [1.0, 1.0, 0.0, 1.0] as vec4,
  GREEN: [0.0, 1.0, 0.0, 1.0] as vec4,
  BLUE: [0.0, 0.0, 1.0, 1.0] as vec4,
  CYAN: [0.0, 1.0, 1.0, 1.0] as vec4,
  PURPLE: [1.0, 0.0, 1.0, 1.0] as vec4,
  WHITE: [1.0, 1.0, 1.0, 1.0] as vec4,
  GRAY: [0.5, 0.5, 0.5, 1.0] as vec4,
  BROWN: [0.6, 0.4, 0.2, 1.0] as vec4,
};

/**
 * A line with a start and end point.
 *
 * It requires a precompiled shader program and its attributes to work.
 */
export abstract class Line {
  protected readonly vertBuf_: WebGLBuffer;
  protected color_: vec4;
  protected isDraw_ = true;
  referenceFrame: 'J2000' | 'TEME' = 'TEME';
  /** This flag is set to true when the line is no longer needed. The garbage collector will handle removing it */
  isGarbage = false;
  /**
   * Camera-anchored lines add the camera position instead of the pass world
   * offset, pinning them to the celestial sphere so they never parallax
   * (constellation figures must track the camera-anchored star dots).
   */
  isCameraAnchored = false;
  /**
   * 0-1 multiplier applied to this line's alpha at draw time, for fades that must not
   * disturb the stored color (a proximity fade has to be able to come back exactly).
   */
  opacity = 1;

  constructor(dataPoints = 2) {
    const gl = ServiceLocator.getRenderer().gl;

    this.vertBuf_ = gl.createBuffer();
    GlUtils.bindBufferDynamicDraw(gl, this.vertBuf_, new Float32Array(dataPoints * 4));
  }

  /**
   * This assumes that LineManager.drawFirst has already run and LineManager.drawLast will run after all lines are drawn.
   */
  draw(gl: WebGL2RenderingContext, lineManager: LineManager): void {
    if (!this.isDraw_) {
      return;
    }

    gl.uniform4fv(lineManager.uniforms_.u_color, this.getDrawColor_());

    if (this.isCameraAnchored) {
      gl.uniform3fv(lineManager.uniforms_.worldOffset, lineManager.cameraAnchorWorldOffset);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertBuf_);
    gl.vertexAttribPointer(lineManager.attribs.a_position.location, 4, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.LINE_STRIP, 0, 2);

    if (this.isCameraAnchored) {
      gl.uniform3fv(lineManager.uniforms_.worldOffset, lineManager.passWorldOffset);
    }
  }

  abstract update(): void;

  /**
   * Describe this line for the line-management UI. Subclasses override to provide a
   * stable `kind` key (and optional `detail`) so the UI can label and group lines.
   */
  getDescription(): LineDescription {
    return { kind: 'generic' };
  }

  updateVertBuf(points: vec3[]): void {
    const gl = ServiceLocator.getRenderer().gl;

    GlUtils.bindBufferDynamicDraw(gl, this.vertBuf_, new Float32Array([points[0][0], points[0][1], points[0][2], 1.0, points[1][0], points[1][1], points[1][2], 1.0]));
  }

  protected validateColor(color: vec4): void {
    if (color[0] < 0 || color[0] > 1 || color[1] < 0 || color[1] > 1 || color[2] < 0 || color[2] > 1 || color[3] < 0 || color[3] > 1) {
      throw new Error('Invalid color');
    }
  }

  /** This line's color with {@link opacity} folded into the alpha. */
  protected getDrawColor_(): vec4 {
    if (this.opacity >= 1) {
      return this.color_;
    }

    return [this.color_[0], this.color_[1], this.color_[2], this.color_[3] * Math.max(this.opacity, 0)];
  }
}
