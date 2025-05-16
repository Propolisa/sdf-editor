import { ComputeShader, UniformBuffer, Vector2 } from '@babylonjs/core'

/**
 * Creates a 1×1 compute pass that reads your full-res
 * shape-ID buffer at the mouse UV and writes picked_shape[0].
 */
export function createShapePicker(engine) {
  // 1) Inline WGSL source
  const computeSource = `
    struct Params {
        resolution : vec2<f32>,
        mouseUV    : vec2<f32>,
    };
    @group(0) @binding(0) var<uniform> params : Params;
    @group(0) @binding(1) var<storage,read>  raymarch_shape_out_buffer : array<u32>;
    @group(0) @binding(2) var<storage,read_write> picked_shape           : array<i32>;


    fn sampleShapeID(vUV: vec2<f32>) -> u32 {
        let px  = vec2<i32>(
            i32(vUV.x * params.resolution.x),
            i32(vUV.y * params.resolution.y)
        );
        let idx = px.y * i32(params.resolution.x) + px.x;
        return raymarch_shape_out_buffer[idx];
    }

    @compute @workgroup_size(1,1,1)
    fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
        // one invocation only: gid.x == 0
        picked_shape[0] = i32(sampleShapeID(params.mouseUV));
    }
  `

  // 2) Create the compute shader
  const cs = new ComputeShader(
    'shapePickerCS',
    engine,
    { computeSource },
    {
      bindingsMapping: {
        params: { group: 0, binding: 0 },
        raymarch_shape_out_buffer: { group: 0, binding: 1 },
        picked_shape: { group: 0, binding: 2 },
      },
    },
  )

  // 3) UniformBuffer for (resolution, mouseUV)
  const paramsUB = new UniformBuffer(engine)
  paramsUB.addUniform('resolution', 2)
  paramsUB.addUniform('mouseUV', 2)
  paramsUB.update() // allocate

  // bind it once
  cs.setUniformBuffer('params', paramsUB)

  return {
    /**
     * bind your two storage buffers once at startup
     */
    setBuffers: (shapeBuf, pickBuf) => {
      cs.setStorageBuffer('raymarch_shape_out_buffer', shapeBuf)
      cs.setStorageBuffer('picked_shape', pickBuf)
    },

    /**
     * call each frame with the normalized mouseUV (Vector2)
     * returns a Promise that resolves once the GPU pass is done
     */
    dispatch: (mouseUV) => {
      // update uniforms
      paramsUB.updateFloat2(
        'resolution',
        engine.getRenderWidth(false), engine.getRenderHeight(false)
      )
      paramsUB.updateFloat2('mouseUV', ...mouseUV.asArray())
      paramsUB.update()

      // dispatch a 1×1×1 compute grid
      return cs.dispatchWhenReady(1, 1, 1)
    },
  }
}
