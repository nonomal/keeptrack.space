import { rgbaArray } from '@app/engine/core/interfaces';
import { ServiceLocator } from '@app/engine/core/service-locator';
import { BaseObject } from '@ootk/src/main';

export class Planet extends BaseObject {
  color: rgbaArray = [0.0, 1.0, 0.0, 1.0];

  setHoverDotSize(gl: WebGL2RenderingContext, size: number): void {
    const dotsManagerInstance = ServiceLocator.getDotsManager();

    gl.bindBuffer(gl.ARRAY_BUFFER, dotsManagerInstance.buffers.size);
    gl.bufferSubData(gl.ARRAY_BUFFER, Number(this.id), new Int8Array([size]));
  }

  /**
   * Turn this dot's pick target on or off.
   *
   * Hiding a dot with {@link setHoverDotSize} does NOT make it unclickable - the picking
   * shader sizes its square from the pick uniforms and only zeroes it through `a_pickable`.
   * A refresh of the color scheme rewrites the whole buffer (planets come back as
   * pickable), so callers that want this to stick have to reassert it.
   */
  setPickable(gl: WebGL2RenderingContext, isPickable: boolean): void {
    const pickabilityBuffer = ServiceLocator.getDotsManager().buffers.pickability;

    // The color scheme hands this buffer over only once it has built its first frame of
    // color data, which never happens at all in a catalog-less boot.
    if (!pickabilityBuffer) {
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, pickabilityBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, Number(this.id), new Int8Array([isPickable ? 1 : 0]));
  }

  protected serializeSpecific(): Record<string, unknown> {
    return {};
  }
}
