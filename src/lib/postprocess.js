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
  WebGPUTintWASM,
  Camera,
} from '@babylonjs/core'
import { MAX_BYTECODE_LENGTH } from './defaults'
import { generateWGSL } from './sd-scene-shader-representation'
import { watch, toRef } from 'vue'
import { createShapePicker } from './raymarch_picking_compute_shader'
import { createShapePickerJS } from './raymarch_picking'
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
    
    
        var<storage,read_write> hovered_shape : array<i32>;
        var<storage,read_write> raymarch_depth_out_buffer : array<f32>;
        var<storage,read_write> raymarch_shape_out_buffer : array<u32>;
        uniform cameraOrtho       : u32;         // 0 = perspective, 1 = orthographic
        uniform camOrthoHalfWidth : f32;         // = (orthoRight - orthoLeft) / 2
        uniform camOrthoHalfHeight: f32;         // = (orthoTop   - orthoBottom) / 2

        uniform program: array<f32, ${MAX_BYTECODE_LENGTH}>;
        uniform programLength: u32;
        uniform camTransformInv: mat4x4<f32>;
        uniform camMinZ: f32;
        uniform camMaxZ: f32;
        uniform camWorld: mat4x4<f32>;
        uniform camPosition: vec3<f32>;
        uniform bound_near: vec3<f32>;
        uniform bound_far: vec3<f32>;
        uniform resolution: vec2<f32>;
        uniform mouseUV : vec2<f32>;
        uniform eps: f32;
        uniform adaptiveEpsilon: u32;
        uniform camTanFov: f32;
        uniform lightDir: vec3<f32>;
        uniform maxSteps: u32;
        uniform maxDist: f32;
        
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
    
      struct Ray { origin: vec3<f32>, dir: vec3<f32>, };
       // perspective: identical to your old getRayFromScreenSpaceNonNorm +
       // origin = camPosition
       fn getPerspectiveRay(vUV: vec2<f32>) -> Ray {
           let n   = vec4<f32>((vUV.x - 0.5)*2.0, (vUV.y - 0.5)*2.0, -1.0, 1.0);
           let f   = vec4<f32>((vUV.x - 0.5)*2.0, (vUV.y - 0.5)*2.0,  1.0, 1.0);
           var nr = uniforms.camTransformInv * n;
           var fr = uniforms.camTransformInv * f;
           nr /= nr.w;  fr /= fr.w;
           let d = normalize(fr.xyz - nr.xyz);
           return Ray(uniforms.camPosition, d);
       }
       // orthographic: rays are parallel (–Z in camera space), origin offset in XY
       fn getOrthoRay(vUV: vec2<f32>) -> Ray {
            // normalized screen offset [-1,1]
            let ns      = (vUV - vec2<f32>(0.5)) * 2.0;
            let right   = (uniforms.camWorld * vec4<f32>(1,0,0,0)).xyz;
            let up      = (uniforms.camWorld * vec4<f32>(0,1,0,0)).xyz;
            // correct forward = +Z in LH system
            let forward = normalize((uniforms.camWorld * vec4<f32>(0,0,1,0)).xyz);

            // place the ray on the near‐plane of the ortho frustum,
            // then offset in X/Y to cover the full box
            let o = uniforms.camPosition
                  + forward * uniforms.camMinZ
                  + right   * (ns.x * uniforms.camOrthoHalfWidth)
                  + up      * (ns.y * uniforms.camOrthoHalfHeight);

            return Ray(o, forward);
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
    // Distance-only SDF
fn sdf(p: vec3<f32>) -> f32 {
    return sdRpn(p);
}

// Updated RayHit now includes the surface normal, AO, AND closest-point info
struct RayHit {
    hit:            bool,
    distance:       f32,
    position:       vec3<f32>,
    normal:         vec3<f32>,
    ao:             f32,
    material:       vec4<f32>,
    shapeID:        u32,
    // Added fields for the closest point along the ray
    closestPosition: vec3<f32>,
    closestDistance: f32,
}

// Raymarching function now also tracks the closest point (min |SDF|) along the ray
fn raymarch(origin: vec3<f32>, dir: vec3<f32>) -> RayHit {
    var totalDistance: f32 = 0.0;
    let MAX_DISTANCE = uniforms.maxDist;
    let MAX_STEPS = uniforms.maxSteps;
    var pos = origin;
    var hit: bool = false;

    // For tracking the closest point
    var minAbsDist: f32 = MAX_DISTANCE;
    var closestPos:    vec3<f32> = origin;
    var closestDist:   f32 = MAX_DISTANCE;

    // March loop
    for (var i: u32 = 0; i < MAX_STEPS; i = i + 1) {
        pos = origin + totalDistance * dir;
        let d = sdf(pos);
        let absd = abs(d);
        // Update closest-point info
        if (absd < minAbsDist) {
            minAbsDist = absd;
            closestPos = pos;
            closestDist = totalDistance;
        }
        // Hit test (adaptive or fixed epsilon)
        if (d < select(uniforms.eps, get_epsilon(totalDistance), uniforms.adaptiveEpsilon == 1u)) {
            hit = true;
            break;
        }
        totalDistance = totalDistance + d;
        if (totalDistance > MAX_DISTANCE) {
            break;
        }
    }

    // Defaults
    var mat:     vec4<f32>    = vec4<f32>(1.0, 1.0, 1.0, 1.0);
    var N:       vec3<f32>    = vec3<f32>(0.0, 1.0, 0.0);
    var occ:     f32          = 1.0;
    var shapeID: u32          = 0u;
    // Choose which point we return: the hit point or closest point
    let finalPos  = select(closestPos, pos, hit);
    let finalDist = select(closestDist, totalDistance, hit);

    if (hit) {
        // Full material + normal + AO eval at the true surface
        let res = sdRpnMaterial(pos);
        mat     = res.color;
        shapeID = res.shapeID;
        N       = res.normal;
        occ     = res.ao;
    }

    return RayHit(
        hit,
        finalDist,
        finalPos,
        N,
        occ,
        mat,
        shapeID,
        closestPos,
        closestDist
    );
}


@fragment
fn main(input: FragmentInputs) -> FragmentOutputs {


    // 1) Background
    let uv         = input.vUV;
    let sceneColor = textureSample(SceneTexture, SceneTextureSampler, uv);

    // 2) Primary ray

    var ray: Ray = getPerspectiveRay(uv);
    if (uniforms.cameraOrtho == 1u) {
        ray = getOrthoRay(uv);
    }
    let rayOrigin = ray.origin;
    let rayDir    = ray.dir;

    // 3) Raymarch
    let hitRes = raymarch(rayOrigin, rayDir);

    // 4) Pixel coords (for depth & picking)
    let fragPx = vec2<i32>(
        i32(uv.x * uniforms.iResolution.x),
        i32(uv.y * uniforms.iResolution.y)
    );

    // 5) Shade or show background
    var col: vec4<f32>;
    if (hitRes.hit) {
        // 5b) Lighting & AO
        let diff     = clamp(dot(hitRes.normal, uniforms.lightDir), 0.3, 1.0);
        let env      = environmentLight(rayDir);
        let lighting = hitRes.material.rgb * diff + 0.2 * env;
        col = vec4<f32>(lighting * hitRes.ao, hitRes.material.a);
    }
    else {
        col = sceneColor;
    }

    // 7) Write depth
    let idx = fragPx.y * i32(uniforms.iResolution.x) + fragPx.x;
    raymarch_depth_out_buffer[idx] = hitRes.distance;
    raymarch_shape_out_buffer[idx] = hitRes.shapeID;

    // 8) Output
    var out: FragmentOutputs;
    out.color = col;
    return out;
}

    
    `

  ShaderStore.ShadersStoreWGSL['compositeFragmentShader'] = `
    uniform iResolution        : vec2<f32>;
    uniform borderThicknessPx : f32;     
    uniform selectedShapeId   : u32;     
    var<storage,read_write> hovered_shape : array<i32>;
    var<storage,read_write> raymarch_depth_out_buffer : array<f32>;
    var<storage,read_write> raymarch_shape_out_buffer : array<u32>;
    var DepthMapTexture        : texture_2d<f32>;
    var DepthMapTextureSampler : sampler;
    var textureSampler         : texture_2d<f32>;
    var textureSamplerSampler  : sampler;
    var sceneSampler           : texture_2d<f32>;
    var sceneSamplerSampler    : sampler;

    const MAX_RM_DIST     : f32 = 20.0;
    const DEPTH_THRESHOLD : f32 = 1.;

    fn sampleDepth(vUV: vec2<f32>) -> f32 {
        let px  = vec2<i32>(
            i32(vUV.x * uniforms.iResolution.x),
            i32(vUV.y * uniforms.iResolution.y)
        );
        let idx = px.y * i32(uniforms.iResolution.x) + px.x;
        return raymarch_depth_out_buffer[idx];
    }

    fn sampleShapeID(vUV: vec2<f32>) -> u32 {
        let px  = vec2<i32>(
            i32(vUV.x * uniforms.iResolution.x),
            i32(vUV.y * uniforms.iResolution.y)
        );
        let idx = px.y * i32(uniforms.iResolution.x) + px.x;
        return raymarch_shape_out_buffer[idx];
    }

    // Helper: boost saturation & brightness
    fn bumpColor(color: vec3<f32>, satFactor: f32, brightFactor: f32) -> vec3<f32> {
        let gray = dot(color, vec3<f32>(0.299, 0.587, 0.114));
        let saturated = mix(vec3<f32>(gray), color, satFactor);
        return saturated * brightFactor;
    }


    @fragment
    fn main(input: FragmentInputs) -> FragmentOutputs {
    
        let uv = input.vUV;

        // 1) Read depths & colors
        let sceneDepth = textureSample(DepthMapTexture, DepthMapTextureSampler, uv).r;
        let rayDepth   = sampleDepth(uv);
        let sceneCol   = textureSample(sceneSampler, sceneSamplerSampler, uv);
        let rayCol     = textureSample(textureSampler, textureSamplerSampler, uv);

        // 2) Depth‐blend as before
        var outColor: vec4<f32>;
        if (rayDepth < sceneDepth) {
                outColor = rayCol;
            } else {
                outColor = sceneCol;
            }

        // 3) Shape‐ID border test *only* for selected shape
        let centerID   = sampleShapeID(uv);
        let hoveredID = u32(hovered_shape[0]);
        let isSelected = centerID == uniforms.selectedShapeId && centerID != 0u;
        var borderF: f32;        
        if (centerID != 0u){

         let sampleDirs = array<vec2<f32>, 8>(
                vec2<f32>( 1.0,  0.0),
                vec2<f32>( 0.70710678,  0.70710678),
                vec2<f32>( 0.0,  1.0),
                vec2<f32>(-0.70710678,  0.70710678),
                vec2<f32>(-1.0,  0.0),
                vec2<f32>(-0.70710678, -0.70710678),
                vec2<f32>( 0.0, -1.0),
                vec2<f32>( 0.70710678, -0.70710678)
            );

            // 2) radius in pixels
            let r = uniforms.borderThicknessPx;

            // 3) count how many of those 8 samples differ
            var diffCount: i32 = 0;
            for (var i: i32 = 0; i < 8; i = i + 1) {
                // offset in UV space
                let offsUV = uv + sampleDirs[i] * (r / uniforms.iResolution);
                let sid    = sampleShapeID(offsUV);
                if (isSelected && sid != centerID) {
                    diffCount = diffCount + 1;
                }
            }

            // 4) blend factor = fraction of “outside” samples
            borderF = f32(diffCount) / 4.0;
        }
      

        // 5) apply bump + red blend just on selected shape
        if (isSelected) {
            let lit = bumpColor(outColor.rgb, 1.8, 1.5);
            
                outColor    = mix(outColor, vec4<f32>(1.0, 0.0, 0.0, 1.0), borderF);

        }

        if (hoveredID == centerID && centerID != 0u){
          let boosted = bumpColor(outColor.rgb, 1.8, 1.5);
          outColor = vec4<f32>(boosted, outColor.a);
        }
            

        // 5) output
        var out: FragmentOutputs;
        out.color = outColor;
        return out;
    }
`

  const rayBox = MeshBuilder.CreateBox('rayBox', { size: 4 })
  rayBox.position.y = 2
  rayBox.visibility = 0
  rayBox.isVisible = false

  // create or re-create depth renderer, texture, and both buffers

  let hovered_shape_buffer = new StorageBuffer(
    engine,
    Uint32Array.BYTES_PER_ELEMENT,
    Constants.BUFFER_CREATIONFLAG_WRITE | Constants.BUFFER_CREATIONFLAG_READ,
  )
  // make the picker
  const shapePicker = createShapePickerJS(engine)
  var depth_renderer, depth_texture, raymarch_depth_out_buffer, raymarch_shape_out_buffer
  const handleResize = () => {
    // (1) rebuild depth pass
    scene.disableDepthRenderer()
    depth_renderer = scene.enableDepthRenderer(camera, undefined, undefined, undefined, true)
    depth_texture = depth_renderer.getDepthMap()

    // (2) dispose old buffers if they exist
    if (raymarch_depth_out_buffer) {
      raymarch_depth_out_buffer.dispose()
    }
    if (raymarch_shape_out_buffer) {
      raymarch_shape_out_buffer.dispose()
    }

    // (3) create new buffers at current size
    const w = engine.getRenderWidth() * global_settings.display.resolution_multiplier
    const h = engine.getRenderHeight() * global_settings.display.resolution_multiplier
    // compute pixel count and pad to a multiple of 4 elements
    const pixelCount = w * h
    const paddedCount = Math.ceil(pixelCount / 4) * 4

    // allocate padded buffers
    raymarch_depth_out_buffer = new StorageBuffer(
      engine,
      Float32Array.BYTES_PER_ELEMENT * paddedCount,
    )
    raymarch_shape_out_buffer = new StorageBuffer(
      engine,
      Uint32Array.BYTES_PER_ELEMENT * paddedCount,
    )

    // (4) re-bind into your picker so it always uses the latest shape buffer
    shapePicker.setBuffers(raymarch_shape_out_buffer, hovered_shape_buffer)
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
      'program',
      'camOrthoHalfHeight',
      'camOrthoHalfWidth',
      'cameraOrtho',
      'camMinZ',
      'camMaxZ',
      'programLength',
      'maxDist',
      'maxSteps',
    ],
    shaderLanguage: ShaderLanguage.WGSL,
    engine: scene.getEngine(),
  })

  let last_sum = 0
  raymarchPass.onEffectCreatedObservable.addOnce((effect) => {
    effect.onCompileObservable.addOnce((effect) => {
      let shader_data = generateWGSL(sdSceneRepresentation)
      let new_sum = shader_data.program.reduce((prev, curr) => prev + curr, 0)
      if (last_sum != new_sum) {
        state.trigger_redraw = 1
        effect.setFloatArray('program', new Float32Array(shader_data.program))
      }
      last_sum = new_sum
      effect.setInt('programLength', shader_data.programLength)
      // Ensure the scene has an ActionManager.
      scene.actionManager = scene.actionManager || new ActionManager(scene)

      // Register an action for pointer movement.

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

      watch(
        toRef(global_settings.display.raymarch, 'max_steps'),
        (n, o) => {
          effect.setUInt('maxSteps', n)
        },
        { immediate: true },
      )
      watch(
        toRef(global_settings.display.raymarch, 'max_dist'),
        (n, o) => {
          effect.setFloat('maxDist', n)
        },
        { immediate: true },
      )
      effect.setFloat('camTanFov', Math.tan(camera.fov * 0.5))
      effect.setVector2(
        'resolution',
        new Vector2(engine.getRenderWidth(), engine.getRenderHeight()),
      )
    })
  })

  raymarchPass.onApplyObservable.add((effect) => {
    let shader_data = generateWGSL(sdSceneRepresentation)
    let new_sum = shader_data.program.reduce((prev, curr) => prev + curr, 0)
    if (last_sum != new_sum) {
      effect.setFloatArray('program', new Float32Array(shader_data.program))
    }
    last_sum = new_sum
    effect.setInt('programLength', shader_data.programLength)
    effect.setUInt('cameraOrtho', camera.mode === Camera.ORTHOGRAPHIC_CAMERA ? 1 : 0)
    effect.setFloat('camOrthoHalfWidth', (camera.orthoRight - camera.orthoLeft) * 0.5)
    effect.setFloat('camOrthoHalfHeight', (camera.orthoTop - camera.orthoBottom) * 0.5)
    engine.setStorageBuffer('raymarch_depth_out_buffer', raymarch_depth_out_buffer)
    engine.setStorageBuffer('raymarch_shape_out_buffer', raymarch_shape_out_buffer)
    engine.setStorageBuffer('hovered_shape', hovered_shape_buffer)

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

  compositePass.onApplyObservable.addOnce((effect) => {
    compositePass.onBeforeRenderObservable.add(async (effect) => {


      const canvasWidth = engine.getRenderWidth()
      const canvasHeight = engine.getRenderHeight()
      // Normalize X from 0 to 1
      const x = scene.pointerX / (canvasWidth * global_settings.display.resolution_multiplier)
      // Flip the Y coordinate: pointer 0 (top) -> 1, pointer canvasHeight (bottom) -> 0
      const y =
        1.0 - scene.pointerY / (canvasHeight * global_settings.display.resolution_multiplier)
      const mouseUV = new Vector2(x, y)
      let picked_id = await shapePicker.pick(mouseUV)
      if (picked_id != state.selected_shape_id) {
        if (state.trigger_redraw >= 0) state.trigger_redraw = 10
        state.selected_shape_id_buffer = picked_id
      }
    })
  })
  compositePass.onApplyObservable.add((effect) => {
    effect.setVector2(
      'iResolution',
      new Vector2(engine.getRenderWidth(false), engine.getRenderHeight(false)),
    )
    effect.setFloat('borderThicknessPx', 4 * (1 / global_settings.display.resolution_multiplier)) // e.g. 3 pixels
    effect.setInt('selectedShapeId', state.selected_shape_id) // e.g. 3 pixels
    engine.setStorageBuffer('hovered_shape', hovered_shape_buffer)
    engine.setStorageBuffer('raymarch_depth_out_buffer', raymarch_depth_out_buffer)
    engine.setStorageBuffer('raymarch_shape_out_buffer', raymarch_shape_out_buffer)
    effect._bindTexture('DepthMapTexture', depth_texture.getInternalTexture())
    effect.setTextureFromPostProcess('sceneSampler', scene_copy_pass)
  })

  return raymarchPass
}
