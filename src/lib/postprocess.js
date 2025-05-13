import {
  ShaderStore,
  PostProcess,
  PassPostProcess,
  Vector2,
  MeshBuilder,
  ShaderLanguage,
  StorageBuffer,
  ActionManager,
  Constants,
} from '@babylonjs/core'
import { MAX_BYTECODE_LENGTH } from './defaults'
import { generateWGSL } from './sd-scene-shader-representation'
import { watch, toRef } from 'vue'
// TERMS:
// SDFSceneInstance
// SDFSceneJSON
// SDFSceneBabylonAdapter
// SDFSceneShaderOutputs

export function setupRaymarchingPp(
  scene,
  camera,
  lightDir,
  sdSceneRepresentation,
  global_settings,
  state,
) {
  const engine = scene.getEngine()
  const shader_output = generateWGSL(sdSceneRepresentation)
  window.CODE = shader_output
  ShaderStore.ShadersStoreWGSL['raymarchFragmentShader'] = `
        uniform iResolution : vec2<f32>;
        var SceneTexture: texture_2d<f32>;
        var SceneTextureSampler: sampler;
    
    
        var<storage,read_write> picked_shape : array<i32>;
        var<storage,read_write> raymarch_depth_out_buffer : array<f32>;
        uniform current_picked_shape_ro_index: u32;
        uniform program: array<f32, ${MAX_BYTECODE_LENGTH}>;
        uniform programLength: u32;
        uniform camTransformInv: mat4x4<f32>;
        uniform camPosition: vec3<f32>;
        uniform bound_near: vec3<f32>;
        uniform bound_far: vec3<f32>;
        uniform resolution: vec2<f32>;
        uniform mouseUV : vec2<f32>;
        uniform eps: f32;
        uniform adaptiveEpsilon: u32;
        uniform camTanFov: f32;
        uniform lightDir: vec3<f32>;
        
        varying vUV: vec2<f32>;
    
        const EPS = 0.0001;
    const FAR = 80.0;
    const PI = 3.1415926;
    
       fn mixFloat(a: f32, b: f32, t: f32) -> f32 {
                return a * (1.0 - t) + b * t;
            }
    
            fn mixVec3(a: vec3<f32>, b: vec3<f32>, t: f32) -> vec3<f32> {
                return a * (1.0 - t) + b * t;
            }
    
        fn getRayFromScreenSpaceNonNorm(vUV: vec2<f32>) -> vec3<f32> {
            var near: vec4<f32> = vec4((vUV.x - 0.5) * 2.0, (vUV.y - 0.5) * 2.0, -1, 1.0);
            var far: vec4<f32> = vec4((vUV.x - 0.5) * 2.0, (vUV.y - 0.5) * 2.0, 1, 1.0);
            var nearResult: vec4<f32> = uniforms.camTransformInv*near;
            var farResult: vec4<f32> = uniforms.camTransformInv*far;
            nearResult /= nearResult.w;
            farResult /= farResult.w;
            let dir: vec4<f32> = farResult - nearResult;
            return dir.xyz;
        }
    
            
    
       ${shader_output.code}
   

// fn ambientOcclusion(p: vec3<f32>, n: vec3<f32>) -> f32 {
//     // you can pull these from uniforms if you like
//     let NUM_SAMPLES:      i32   = 16;
//     let MAX_DIST:         f32   = 0.1;
//     let FALLOFF:          f32   = 1.0;
//     let invNum:           f32   = 1.0 / f32(NUM_SAMPLES);
//     // hemisphere‐mix factor to reduce self‐occlusion with few samples
//     let rad:              f32   = 1.0 - invNum;

//     var aoAcc:            f32   = 0.0;

//     for (var i: i32 = 0; i < NUM_SAMPLES; i = i + 1) {
//         let fi:            f32   = f32(i);
//         // pick a random length in [0, MAX_DIST]
//         let l:             f32   = hash(fi) * MAX_DIST;
//         // pick a direction skewed towards the normal
//         let hemi:          vec3<f32> = randomHemisphereDir(n, fi);
//         let dir:           vec3<f32> = normalize(n + hemi * rad);
//         // evaluate the SDF
//         let d:             f32   = max(sdf(p + dir * l), 0.0);
//         // accumulate occlusion
//         aoAcc = aoAcc + (l - d) / MAX_DIST * FALLOFF;
//     }

//     let ao:              f32   = 1.0 - aoAcc * invNum;
//     return clamp(ao, 0.0, 1.0);
// }
    // Computes a simple environment light based on the ray direction.
    // This returns a color that blends between a darker and a lighter sky color.
    fn environmentLight(rayDir: vec3<f32>) -> vec3<f32> {
        let skyLight: vec3<f32> = vec3<f32>(0.4, 0.4, 0.8);
        let skyDark:  vec3<f32> = vec3<f32>(0.1, 0.1, 0.4);
        return mix(skyDark, skyLight, clamp(rayDir.y, 0.0, 1.0));
    }
    
    fn get_epsilon(dist: f32) -> f32 {
        // world‑space size of one pixel at distance 'dist'
        let pixelSize = (2.0 * dist * uniforms.camTanFov ) / uniforms.resolution.y;
        // ensure we never go below your base epsilon
        return max(uniforms.eps, pixelSize);
    }
    
    // Use the distance-only evaluation for marching.
    fn sdf(p: vec3<f32>) -> f32 {
        return sdRpn(p);
    }
    
    // Updated RayHit now includes the surface normal and AO.
    struct RayHit {
        hit:      bool,
        distance: f32,
        position: vec3<f32>,
        normal:   vec3<f32>,
        ao:       f32,
        material: vec4<f32>,
        shapeID:  u32
    };
    
    // Basic raymarching function that uses distance-only sdf. Only if a hit is detected
    // do we compute the full material+normal+AO via sdRpnMaterial.
    fn raymarch(origin: vec3<f32>, dir: vec3<f32>) -> RayHit {
        var totalDistance = 0.0;
        let MAX_DISTANCE = 30.0;
        let MAX_STEPS = 200;
        var pos: vec3<f32> = origin;
        var hit: bool = false;
        
        // March along the ray using the fast distance-only SDF.
        for (var i: i32 = 0; i < MAX_STEPS; i = i + 1) {
            pos = origin + totalDistance * dir;
            let d = sdf(pos);
            if (d < select(uniforms.eps, get_epsilon(totalDistance), uniforms.adaptiveEpsilon == 1)) {
                hit = true;
                break;
            }
            totalDistance = totalDistance + d;
            if (totalDistance > MAX_DISTANCE) {
                break;
            }
        }
        
        // Defaults
        var mat:     vec4<f32> = vec4<f32>(1.0, 1.0, 1.0, 1.0);
        var N:       vec3<f32> = vec3<f32>(0.0, 1.0, 0.0);
        var occ:     f32       = 1.0;
        var shapeID: u32       = 0u;
        
        if (hit) {
            // Final full evaluation: gives us color, shapeID, normal, ao
            let res = sdRpnMaterial(pos);
            mat     = res.color;
            shapeID = res.shapeID;
            N       = res.normal;
            occ     = res.ao;
        }
        
        return RayHit(hit, totalDistance, pos, N, occ, mat, shapeID);
    }
    
    //-- Helper: boost saturation & brightness --
    fn bumpColor(color: vec3<f32>, satFactor: f32, brightFactor: f32) -> vec3<f32> {
        let gray = dot(color, vec3<f32>(0.299, 0.587, 0.114));
        let saturated = mix(vec3<f32>(gray), color, satFactor);
        return saturated * brightFactor;
    }
    
    @fragment
    fn main(input : FragmentInputs) -> FragmentOutputs {
        // background
        var sceneColor: vec4<f32> = textureSample(SceneTexture, SceneTextureSampler, input.vUV);
    
        let rayOrigin    = uniforms.camPosition;
        let rayDirection = normalize(getRayFromScreenSpaceNonNorm(input.vUV));
    
        // raymarch
        let hitResult = raymarch(rayOrigin, rayDirection);
        let fragPx  = vec2<i32>(
            i32(input.vUV.x * uniforms.iResolution.x),
            i32(input.vUV.y * uniforms.iResolution.y)
        );
        let mousePx = vec2<i32>(
            i32(uniforms.mouseUV.x * uniforms.iResolution.x),
            i32(uniforms.mouseUV.y * uniforms.iResolution.y)
        );
        var col: vec4<f32>;
        if (hitResult.hit) {
            // pick highlighting
            if (fragPx.x == mousePx.x && fragPx.y == mousePx.y) {
                picked_shape[
                    select(0u, 1u, uniforms.current_picked_shape_ro_index == 0u)
                ] = i32(hitResult.shapeID);
            }
            // lighting
            let diffuse: f32 = clamp(dot(hitResult.normal, uniforms.lightDir), 0.3, 1.0);
            let env:     vec3<f32> = environmentLight(rayDirection);
            let lighting: vec3<f32> = hitResult.material.rgb * diffuse + 0.2 * env;
    
            // apply precomputed AO
            col = vec4<f32>(lighting * hitResult.ao, hitResult.material.a);
    
            // picked-shape tint
            if (u32(picked_shape[uniforms.current_picked_shape_ro_index]) == hitResult.shapeID) {
                let boosted = bumpColor(col.rgb, 1.8, 1.5);
                col = vec4<f32>(boosted, col.a);
            }
        } else {
            col = sceneColor;
        }
    
        // write depth
        let pixelCoords: vec2<i32> = vec2<i32>(
            i32(input.vUV.x * uniforms.iResolution.x),
            i32(input.vUV.y * uniforms.iResolution.y)
        );
        let index: i32 = pixelCoords.y * i32(uniforms.iResolution.x) + pixelCoords.x;
        raymarch_depth_out_buffer[index] = hitResult.distance;
    
        var o: FragmentOutputs;
        o.color = col;
        return o;
    }

    
    `

  ShaderStore.ShadersStoreWGSL['compositeFragmentShader'] = `
        uniform iResolution : vec2<f32>;
        var<storage,read_write> raymarch_depth_out_buffer : array<f32>;
        var DepthMapTexture: texture_2d<f32>;
        var DepthMapTextureSampler: sampler;
        var textureSampler: texture_2d<f32>;
        var textureSamplerSampler: sampler;
        
        var sceneSampler: texture_2d<f32>;
        var sceneSamplerSampler: sampler;
    fn sampleDepth(vUV: vec2<f32>) -> f32 {
        // Convert normalized UV to pixel coordinates.
        let pixelCoords: vec2<i32> = vec2<i32>(
            i32(vUV.x * uniforms.iResolution.x),
            i32(vUV.y * uniforms.iResolution.y)
        );
        // Compute the 1D index: index = y * screenWidth + x.
        let index: i32 = pixelCoords.y * i32(uniforms.iResolution.x) + pixelCoords.x;
        return raymarch_depth_out_buffer[index];
    }
    
    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
        // Sample the "scene" depth from the depth texture.
        let sceneDepth: f32 = textureSample(DepthMapTexture, DepthMapTextureSampler, input.vUV).r;
        // Sample the raymarched depth stored in the storage buffer.
        let rayDepth: f32 = sampleDepth(input.vUV);
    
        // Get the scene color and the raymarched color.
        let sceneCol: vec4<f32> = textureSample(sceneSampler, sceneSamplerSampler, input.vUV);
        let rayCol: vec4<f32> = textureSample(textureSampler, textureSamplerSampler, input.vUV);
    
        var outColor: vec4<f32>;
        let threshold: f32 = 5.;
    
        // Check if the difference between the two depths is within the threshold.
        if (abs(rayDepth - sceneDepth) < threshold) {
            // Compute an interpolation factor that moves from 0 to 1 as the depths become more similar.
            // When the depths are identical, t is 1.
            let t: f32 = 1.0 - (abs(rayDepth - sceneDepth) / threshold);
            // Use the closer pass as the dominant color.
            if (rayDepth < sceneDepth) {
                // Raymarch color is closer, so blend toward it.
                outColor = mix(sceneCol, rayCol, t);
            } else {
                // Scene color is closer, so blend toward it.
                outColor = mix(rayCol, sceneCol, t);
            }
        } else {
            // Outside the threshold, choose the "winner": the pass with the lower (closer) depth value.
            if (rayDepth < sceneDepth) {
                outColor = rayCol;
            } else {
                outColor = sceneCol;
            }
        }
    
        return FragmentOutputs(outColor);
    }
    
    `

  const rayBox = MeshBuilder.CreateBox('rayBox', { size: 4 })
  rayBox.position.y = 2
  rayBox.visibility = 0
  rayBox.isVisible = false

  var depth_renderer, depth_texture
  const handleResize = () => {
    scene.disableDepthRenderer()
    depth_renderer = scene.enableDepthRenderer(camera, undefined, undefined, undefined, true)
    depth_texture = depth_renderer.getDepthMap()
  }

  scene.getEngine().onResizeObservable.add(() => {
    handleResize()
  })

  handleResize()
  var scene_copy_pass = new PassPostProcess('Scene copy', 1, camera)

  const raymarchPass = new PostProcess('raymarching', 'raymarch', {
    size: 1,
    samplers: ['SceneTexture'],
    uniforms: [
      'position',
      'normal',
      'uv',
      'camPosition',
      'eps',
      'resolution',
      'camTanFov',
      'adaptiveEpsilon',
      'lightDir',
      'mouseUV',
      'current_picked_shape_ro_index',
      'program',
      'programLength',
    ],
    shaderLanguage: ShaderLanguage.WGSL,
    engine: scene.getEngine(),
  })

  let raymarch_depth_out_buffer = new StorageBuffer(
    scene.getEngine(),
    Float32Array.BYTES_PER_ELEMENT *
      scene.getEngine().getRenderWidth() *
      scene.getEngine().getRenderHeight(),
  )

  let picked_shape_buffer = new StorageBuffer(
    engine,
    Uint32Array.BYTES_PER_ELEMENT * 4,
    Constants.BUFFER_CREATIONFLAG_WRITE | Constants.BUFFER_CREATIONFLAG_READ,
  )
  let read_write_toggle = 0
  scene.onBeforeRenderObservable.add((_) => {
    picked_shape_buffer.read().then((data) => {
      data = new Uint32Array(data.buffer)
      let candidate = data[read_write_toggle ? 1 : 0]
      if (candidate != state.selected_shape_id) {
        state.selected_shape_id_buffer = candidate
      }
    })
  })
  raymarchPass.onBeforeRenderObservable.add((effect) => {
    picked_shape_buffer.update(new Uint32Array([0]), !read_write_toggle ? 4 : 0)

    effect.setInt('current_picked_shape_ro_index', read_write_toggle)

    read_write_toggle = read_write_toggle ? 0 : 1
  })
  let last_sum = 0
  raymarchPass.onApplyObservable.addOnce((effect) => {
    let mouseUV = new Vector2(999999, 999999)
    let shader_data = generateWGSL(sdSceneRepresentation)
    let new_sum = shader_data.program.reduce((prev, curr) => prev + curr, 0)
    if (last_sum != new_sum) {
      effect.setFloatArray('program', new Float32Array(shader_data.program))
    }
    last_sum = new_sum
    effect.setInt('programLength', shader_data.programLength)
    // Ensure the scene has an ActionManager.
    scene.actionManager = scene.actionManager || new ActionManager(scene)

    // Register an action for pointer movement.

    scene.onBeforeRenderObservable.add((pointerInfo) => {
      const canvasWidth = engine.getRenderWidth()
      const canvasHeight = engine.getRenderHeight()
      // Normalize X from 0 to 1
      const x = scene.pointerX / (canvasWidth * global_settings.display.resolution_multiplier)
      // Flip the Y coordinate: pointer 0 (top) -> 1, pointer canvasHeight (bottom) -> 0
      const y =
        1.0 - scene.pointerY / (canvasHeight * global_settings.display.resolution_multiplier)
      const mouseUV = new Vector2(x, y)
      effect.setVector2('mouseUV', mouseUV)
    })
    watch(
      toRef(global_settings.display.raymarch, 'adaptive_epsilon'),
      (newValue, oldValue) => {
        effect.setInt('adaptiveEpsilon', newValue ? 1 : 0)
      },
      { immediate: true },
    )

    watch(
      toRef(global_settings.display.raymarch, 'epsilon'),
      (newValue, oldValue) => {
        effect.setFloat('eps', newValue)
      },
      { immediate: true },
    )
    effect.setFloat('camTanFov', Math.tan(camera.fov * 0.5))
    effect.setVector2('resolution', new Vector2(engine.getRenderWidth(), engine.getRenderHeight()))
  })

  raymarchPass.onApplyObservable.add((effect) => {
    let shader_data = generateWGSL(sdSceneRepresentation)
    let new_sum = shader_data.program.reduce((prev, curr) => prev + curr, 0)
    if (last_sum != new_sum) {
      effect.setFloatArray('program', new Float32Array(shader_data.program))
    }
    last_sum = new_sum
    effect.setInt('programLength', shader_data.programLength)
    engine.setStorageBuffer('raymarch_depth_out_buffer', raymarch_depth_out_buffer)
    engine.setStorageBuffer('picked_shape', picked_shape_buffer)

    effect._bindTexture('SceneTexture', raymarchPass.inputTexture.texture)

    effect.setIntArray('scene_shape_buffer_start_indices')
    effect.setVector3('bound_near', rayBox.getBoundingInfo().boundingBox.minimumWorld)
    effect.setVector3('bound_far', rayBox.getBoundingInfo().boundingBox.maximumWorld)
    effect.setMatrix('camTransformInv', camera?.getTransformationMatrix().invert())
    // Normalize the mouse coordinates.

    effect.setVector2('iResolution', new Vector2(engine.getRenderWidth(), engine.getRenderHeight()))
    effect.setVector3('camPosition', camera?.position)
    effect.setVector3('camDirection', camera?.getForwardRay(1).direction)
    effect.setVector3('lightDir', lightDir)
    effect.setFloat('camMinZ', camera?.minZ)
    effect.setFloat('camMaxZ', camera?.maxZ)
    effect.setFloat('camFov', camera?.fov)
    effect.setMatrix('camView', camera?.getViewMatrix())
    effect.setMatrix('camProjection', camera?.getProjectionMatrix())
    effect.setMatrix('camWorld', camera?.getWorldMatrix())
    effect.setMatrix('camTransform', camera?.getTransformationMatrix())
    effect.setVector3('camPosition', camera?.position)
    effect.setInt('current_picked_shape_ro_index', read_write_toggle)
  })

  camera.attachPostProcess(raymarchPass)

  // --- Composite Pass (full-res) using object form and WGSL ---
  // This pass blends the main scene (rendered into a render target) with the low-res raymarch result.
  var compositePass = new PostProcess(
    'Final compose',
    'composite',
    ['sceneIntensity', 'glowIntensity', 'highlightIntensity', 'iResolution'],
    ['sceneSampler', 'DepthMapTexture'],
    1,
    camera,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    ShaderLanguage.WGSL,
  )

  compositePass.onApply = function (effect) {
    engine.setStorageBuffer('raymarch_depth_out_buffer', raymarch_depth_out_buffer)
    effect.setVector2(
      'iResolution',
      new Vector2(engine.getRenderWidth(false), engine.getRenderHeight(false)),
    )
    effect._bindTexture('DepthMapTexture', depth_texture.getInternalTexture())
    effect.setTextureFromPostProcess('sceneSampler', scene_copy_pass)
    // effect.setTextureFromPostProcess("RaymarchTexture", raymarchPass);
  }

  return raymarchPass
}
