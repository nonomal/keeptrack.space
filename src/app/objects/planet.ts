import { rgbaArray } from '@app/engine/core/interfaces';
import { ServiceLocator } from '@app/engine/core/service-locator';
import { BaseObject } from '@ootk/src/main';

export class Planet extends BaseObject {
  color: rgbaArray = [0.0, 1.0, 0.0, 1.0];

  setHoverDotSize(gl: WebGL2RenderingContext, size: number): void {
    const dotsManagerInstance = ServiceLocator.getDotsManager();

    /*
     * The CPU-side array has to move with the GPU byte. It is what the hover system restores
     * a dot to when the cursor leaves it (`sizeData[id] = getSize(id)`), so writing only the
     * buffer meant one hover over a hidden moon put its dot back on screen for good.
     */
    if (dotsManagerInstance.sizeData && dotsManagerInstance.sizeData.length > Number(this.id)) {
      dotsManagerInstance.sizeData[Number(this.id)] = size;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, dotsManagerInstance.buffers.size);
    gl.bufferSubData(gl.ARRAY_BUFFER, Number(this.id), new Int8Array([size]));
  }

  /**
   * Turn this dot's pick target on or off.
   *
   * Hiding a dot with {@link setHoverDotSize} does NOT make it unclickable - the picking
   * shader sizes its square from the pick uniforms and only zeroes it through `a_pickable`.
   *
   * Both the CPU array and the GPU byte are written, because the color scheme re-uploads
   * `pickableData` wholesale. That still leaves a full RECOMPUTE, which unconditionally
   * hands every planet dot `Pickable.Yes` on both the main-thread path
   * (`ColorScheme.earlyExitColor_`) and the worker path (`objectTypePrologue_` in
   * colorCruncher). Nothing here can prevent that - camera-dependent visibility is not
   * something a static object flag can express - so callers must reassert when
   * {@link ColorSchemeManager.pickableUploadGeneration} moves. See
   * `PlanetMoon.updateDotVisibility_`.
   */
  setPickable(gl: WebGL2RenderingContext, isPickable: boolean): void {
    /*
     * Write to the color scheme's buffer, NOT `dotsManager.buffers.pickability`.
     *
     * They are two different WebGLBuffers. `buffers.pickability` is a copy of the reference
     * taken once, in `ColorSchemeManager.setColorScheme`; the color scheme creates its buffer
     * in `initBuffers`, so the two drift apart the moment that runs again. The picking VAO
     * binds `colorSchemeManager.pickableBuffer` (see `DotsManager` VAO setup) and the uploads
     * go there too, which makes it the only one that decides what is clickable.
     *
     * Writing to the stale copy is silently a no-op: measured at Saturn, a hidden Titan read
     * back 0 from `buffers.pickability` and 1 from `pickableBuffer`, so the dot vanished but
     * stayed a click target and stole clicks aimed at the planet.
     */
    const colorSchemeManagerInstance = ServiceLocator.getColorSchemeManager();
    // Unregistered singletons come back undefined rather than throwing, and this runs from the
    // render loop, which can be several frames ahead of the color scheme during boot.
    const pickabilityBuffer = colorSchemeManagerInstance?.pickableBuffer;

    // The color scheme creates this only once it has built its first frame of color data,
    // which never happens at all in a catalog-less boot.
    if (!pickabilityBuffer) {
      return;
    }

    const pickableData = colorSchemeManagerInstance.pickableData;

    if (pickableData && pickableData.length > Number(this.id)) {
      pickableData[Number(this.id)] = isPickable ? 1 : 0;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, pickabilityBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, Number(this.id), new Int8Array([isPickable ? 1 : 0]));
  }

  protected serializeSpecific(): Record<string, unknown> {
    return {};
  }
}
