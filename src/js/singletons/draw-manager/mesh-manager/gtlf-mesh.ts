import { BufferGeometry } from '@app/js/static/buffer-geometry';
import { GLSL3 } from '@app/js/static/material';
import { Mesh } from '@app/js/static/mesh';
import { ShaderMaterial } from '@app/js/static/shader-material';
import { mat4 } from 'gl-matrix';
import * as gltf from 'webgl-gltf';
import { errorManagerInstance } from '../../errorManager';
import { keepTrackApi } from './../../../keepTrackApi';

/**
 * REFERENCE: https://github.com/larsjarlvik/webgl-gltf/blob/master/example/src/app.ts#L52
 */
export class GTLFMesh {
  gl: WebGL2RenderingContext;
  geometry: BufferGeometry;
  material: ShaderMaterial;
  model: gltf.Model;
  program: WebGLProgram;

  constructor(gl: WebGL2RenderingContext, uri: string) {
    this.gl = gl;
    this.material = new ShaderMaterial(gl, {
      uniforms: {
        uProjectionMatrix: { type: 'mat4', value: mat4.create() },
        uViewMatrix: { type: 'mat4', value: mat4.create() },
      },
      fragmentShader: this.shader.frag,
      vertexShader: this.shader.vert,
      glslVersion: GLSL3,
    });
    this.geometry = new BufferGeometry({
      attributes: {
        aVertexPosition: 0,
      },
    });

    const mesh = new Mesh(gl, this.geometry, this.material);
    this.geometry = mesh.geometry;
    this.material = mesh.material;
    this.program = mesh.program;

    gltf
      .loadModel(this.gl, uri)
      .then((model) => {
        this.model = model;
      })
      .catch((error) => {
        errorManagerInstance.error(error, 'GTLFMesh', 'Failed to create GTLFMesh with uri: ' + uri);
      });
  }

  draw(pMatrix: mat4, camMatrix: mat4, tgtBuffer: WebGLBuffer) {
    if (!this.model) return;
    const mesh = this.model.meshes[0];

    const gl = this.gl;

    // Change to the earth shader
    gl.useProgram(this.program);
    // Change to the main drawing buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, tgtBuffer);

    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uProjectionMatrix'), false, pMatrix);
    const viewMatrix = mat4.create();
    mat4.mul(viewMatrix, camMatrix, this.geometry.localMvMatrix);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'uViewMatrix'), false, viewMatrix);

    gl.enable(gl.DEPTH_TEST);
    gl.enableVertexAttribArray(this.geometry.attributes.aVertexPosition);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.positions.buffer);
    gl.vertexAttribPointer(0, mesh.positions.size, mesh.positions.type, false, 0, 0);
    gl.drawElements(gl.TRIANGLES, mesh.elementCount, gl.UNSIGNED_SHORT, 0);
    gl.disableVertexAttribArray(this.geometry.attributes.aVertexPosition);
    gl.disable(gl.DEPTH_TEST);
  }

  shader = {
    frag: keepTrackApi.glsl`
        precision highp float;

        out vec4 fragColor;

        void main() {
            fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }
    `,
    vert: keepTrackApi.glsl`
        in vec3 aVertexPosition;
        uniform mat4 uProjectionMatrix;
        uniform mat4 uViewMatrix;

        void main() {
            gl_Position = uProjectionMatrix * uViewMatrix * vec4(aVertexPosition, 1.0);
        }
    `,
  };
}
