import { SettingsManager } from '../../settings/settings';
import { BufferAttribute } from './buffer-attribute';

export interface DotsShaderProviderConfig {
  /** Fragment shader source for the dots program */
  fragShader: string;
  /** Vertex shader source for the dots program */
  vertShader: string;
  /** Additional buffer attributes beyond the base set (position, color, size, pickable) */
  extraAttribs: Record<string, BufferAttribute>;
  /** Additional uniform names beyond the base set */
  extraUniforms: string[];
}

/**
 * Extension point for plugins that need to provide custom dot rendering shaders.
 * Register via DotsManager.registerShaderProvider() before DotsManager.init().
 */
export interface IDotsShaderProvider {
  /** Return shader configuration. Called during DotsManager.initShaders_(). */
  getShaderConfig(settings: SettingsManager): DotsShaderProviderConfig;

  /** Create extra WebGL buffers. Called during DotsManager.initBuffers(). */
  initExtraBuffers(gl: WebGL2RenderingContext): Record<string, WebGLBuffer>;

  /** Bind extra buffers to the VAO. Called during DotsManager.initVao(). */
  setupExtraVao(gl: WebGL2RenderingContext, attribs: Record<string, BufferAttribute>, buffers: Record<string, WebGLBuffer>): void;

  /** Set extra uniforms before draw. Called during DotsManager.draw(). */
  setExtraUniforms(gl: WebGL2RenderingContext, uniforms: Record<string, WebGLUniformLocation>): void;

  /** Update extra buffers before draw. Called during DotsManager.draw() after position buffer. */
  updateExtraBuffers(gl: WebGL2RenderingContext, buffers: Record<string, WebGLBuffer>): void;

  /** Reset buffer state for catalog swap. Called during DotsManager.resetForCatalogSwap(). */
  resetBufferState(): void;
}
