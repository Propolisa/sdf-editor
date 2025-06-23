// Subset of SD_LIB for reference {
//     "DISTANCE_FUNCTIONS": {
//         "sdSphere": {
//             "title": "Sphere",
//             "fn_name": "sdSphere",
//             "extra_info": "exact",
//             "args": {
//                 "p": "vec3f",
//                 "r": "f32"
//             },
//             "returns": "f32",
//             "body": "return length(p) - r;",
//             "thumb": ""
//         },
//         "sdEllipsoid": {
//             "title": "Ellipsoid",
//             "fn_name": "sdEllipsoid",
//             "extra_info": "bound (not exact)",
//             "args": {
//                 "p": "vec3f",
//                 "r": "vec3f"
//             },
//             "returns": "f32",
//             "body": "let k0 = length(p / r);\n  let k1 = length(p / (r * r));\n  return k0 * (k0 - 1.) / k1;",
//             "thumb": ""
//         }
//     },
//     "BOOLEAN_OPS": {
//         "opUnion": {
//             "title": "Union",
//             "fn_name": "opUnion",
//             "extra_info": "exact (outside)",
//             "args": {
//                 "d1": "f32",
//                 "d2": "f32"
//             },
//             "returns": "f32",
//             "body": "return min(d1, d2);",
//             "thumb": ""
//         },
//         "opSubtract": {
//             "title": "Subtraction",
//             "fn_name": "opSubtract",
//             "extra_info": "bound",
//             "args": {
//                 "d1": "f32",
//                 "d2": "f32"
//             },
//             "returns": "f32",
//             "body": "return max(d1, -d2);",
//             "thumb": ""
//         }
//     },
//     "DISPLACEMENT_OPS": {
//         "opDisplace": {
//             "title": "Displacement",
//             "fn_name": "opDisplace",
//             "extra_info": "bound (not exact)",
//             "args": {
//                 "d1": "f32",
//                 "d2": "f32"
//             },
//             "returns": "f32",
//             "body": "return d1 + d2;",
//             "thumb": ""
//         },
//         "opTwist": {
//             "title": "Twist",
//             "fn_name": "opTwist",
//             "extra_info": "bound",
//             "args": {
//                 "p": "vec3f",
//                 "k": "f32"
//             },
//             "returns": "vec3f",
//             "body": "let s = sin(k * p.y);\n  let c = cos(k * p.y);\n  let m = mat2x2<f32>(vec2f(c, s), vec2f(-s, c));\n  return vec3f(m * p.xz, p.y);",
//             "thumb": ""
//         }
//     },
//     "POSITIONING_OPS": {
//         "opTranslate": {
//             "title": "Translate",
//             "fn_name": "opTranslate",
//             "extra_info": "exact",
//             "args": {
//                 "p": "vec3f",
//                 "t": "vec3f"
//             },
//             "returns": "vec3f",
//             "body": "return p - t;",
//             "thumb": ""
//         },
//         "op90RotateX": {
//             "title": "90 degree rotation: op90RotateX",
//             "fn_name": "op90RotateX",
//             "extra_info": "exact",
//             "args": {
//                 "p": "vec3f"
//             },
//             "returns": "vec3f",
//             "body": "return vec3f(p.x, p.z, -p.y);",
//             "thumb": ""
//         },
//          opInfArray: {
//              title: 'Infinite Repetition',
//              fn_name: 'opInfArray',
//              extra_info: 'exact',
//              args: {
//                p: 'vec3f',
//                c: 'vec3f',
//              },
//              returns: 'vec3f',
//              body: 'return p - c * round(p / c);',
//              thumb: '',
//            },
//            opLimArray: {
//              title: 'Finite Repetition',
//              fn_name: 'opLimArray',
//              extra_info: 'exact',
//              args: {
//                p: 'vec3f',
//                c: 'f32',
//                lim: 'vec3f',
//              },
//              returns: 'vec3f',
//              body: 'return p - c * clamp(round(p / c), -lim, lim);',
//              thumb: '',
//            }
//     },
//     "PRIMITIVE_OPS": {
//         "opElongate": {
//             "title": "Elongation: opElongate",
//             "fn_name": "opElongate",
//             "extra_info": "exact",
//             "args": {
//                 "p": "vec3f",
//                 "h": "vec3f"
//             },
//             "returns": "vec3f",
//             "body": "return p - clamp(p, -h, h);",
//             "thumb": ""
//         },
//         "opElongateCorrect": {
//             "title": "Elongation: opElongateCorrect",
//             "fn_name": "opElongateCorrect",
//             "extra_info": "exact",
//             "args": {
//                 "p": "vec3f",
//                 "h": "vec3f"
//             },
//             "returns": "vec4f",
//             "body": "let q = abs(p) - h;\n  let sgn = 2. * step(vec3f(0.), p) - vec3f(1.);\n  return vec4f(sgn * max(q, vec3f(0.)), min(max(q.x, max(q.y, q.z)), 0.));",
//             "thumb": ""
//         }
//     }
// }

import SD_LIB from './sd-lib'
import { MAX_BYTECODE_LENGTH, MAT_SIZE } from './defaults'
import { explainBytecode, getTypeInfo } from './helpers'

function generateFunctionDef(libEntry) {
  const args = Object.entries(libEntry.args)
    .map(([name, type]) => `${name}: ${type}`)
    .join(', ')
  return `fn ${libEntry.fn_name}(${args}) -> ${libEntry.returns} {
  ${libEntry.body}
}`
}

export function generateWGSL(
  scene,
  { compile_static = false, use_babylon_uniform_init = true } = {},
) {
  scene = scene.root
  let scene_ops = new Set()

  if (!compile_static) {
    for (let key of Object.keys(SD_LIB.DISTANCE_FUNCTIONS)) {
      scene_ops.add(key)
    }
    for (let key of Object.keys(SD_LIB.PRIMITIVE_OPS)) {
      scene_ops.add(key)
    }
    for (let key of Object.keys(SD_LIB.BOOLEAN_OPS)) {
      scene_ops.add(key)
    }
    for (let key of Object.keys(SD_LIB.POSITIONING_OPS)) {
      scene_ops.add(key)
    }
  }

  function collectUsageDetails(node) {
    scene_ops.add(node.op)
    if (node.children) {
      node.children.forEach((child) => collectUsageDetails(child))
    }
    if (node.modifiers) {
      node.modifiers.forEach((modifier) => scene_ops.add(modifier.op))
    }
  }
  collectUsageDetails(scene)

  // Mapping of operation names to numeric opcodes.
  // Ranges:
  //   [0,100): shapes
  //   [100,200): operators (point warping, if any)
  //   [200,300): booleans (operate on distance values)
  //   [300,+): program instructions (stack/context management)
  // start your boolean opcode base at 200
  const booleanBase = 200
  const displacementBase = 300
  const positioningBase = 400
  const opMap = {
    // Shapes:
    ...Object.fromEntries(Object.keys(SD_LIB.DISTANCE_FUNCTIONS).map((op, i) => [op, i])),
    // Booleans:
    ...Object.keys(SD_LIB.BOOLEAN_OPS).reduce((m, opName, idx) => {
      m[opName] = booleanBase + idx
      return m
    }, {}),
    ...Object.keys(SD_LIB.DISPLACEMENT_OPS).reduce((m, opName, idx) => {
      m[opName] = displacementBase + idx
      return m
    }, {}),
    ...Object.keys(SD_LIB.POSITIONING_OPS).reduce((m, opName, idx) => {
      m[opName] = positioningBase + idx
      return m
    }, {}),
    // Context management:
    pushTranslate: 300,
    popContext: 301,
  }
  function compileNode(node) {
    let bytecode = []

    // — 1) Emit any transforms in node.modifiers —
    //     these push a new point+scale context
    if (node.modifiers) {
      for (const mod of node.modifiers) {
        const posDef = SD_LIB.POSITIONING_OPS[mod.op]
        if (!posDef) continue
        bytecode.push(opMap[mod.op])
        for (const [argName] of Object.entries(posDef.args)) {
          if (argName === 'p') continue
          const v = mod.args[argName]
          bytecode.push(...(Array.isArray(v) ? v : [v]))
        }
      }
    }

    // — 2) Boolean ops (union, smooth, etc) —
    const boolDef = SD_LIB.BOOLEAN_OPS[node.op]
    if (boolDef && node.children?.length > 0) {
      // RPN style: child₀ child₁ OP child₂ OP …
      let acc = compileNode(node.children[0])
      for (let i = 1; i < node.children.length; i++) {
        acc = acc.concat(compileNode(node.children[i]))
        acc.push(opMap[node.op])
        // extra float parameter?
        const extra = Object.keys(boolDef.args).filter((a) => a !== 'd1' && a !== 'd2')
        if (extra.length === 1) {
          const v = node.args?.[extra[0]]
          acc.push(...(Array.isArray(v) ? v : [v]))
        }
      }
      bytecode = bytecode.concat(acc)
    } else {
      // — 3) Non-boolean: compile any children first —
      if (node.children) {
        for (const child of node.children) {
          bytecode = bytecode.concat(compileNode(child))
        }
      }

      // — 4) Leaf op: distance, displacement, primitive, or standalone operator —
      const fnDef =
        SD_LIB.DISTANCE_FUNCTIONS[node.op] ||
        SD_LIB.DISPLACEMENT_OPS[node.op] ||
        SD_LIB.PRIMITIVE_OPS[node.op]

      if (fnDef) {
        bytecode.push(opMap[node.op])
        for (const [argName] of Object.entries(fnDef.args)) {
          if (argName === 'p') continue
          const v = node.args?.[argName]
          bytecode.push(...(Array.isArray(v) ? v : [v]))
        }
        // push material (r,g,b,a) + shapeID
        const { r = 1, g = 1, b = 1, a = 1 } = node.material || {}
        bytecode.push(r, g, b, a, node.id)
      } else if (opMap[node.op] != null) {
        // odd single-token ops
        bytecode.push(opMap[node.op])
      }
    }

    // — 5) Pop one context per modifier —
    if (node.modifiers) {
      for (let i = 0; i < node.modifiers.length; i++) {
        bytecode.push(opMap.popContext)
      }
    }

    return bytecode
  }

  const bytecodeArray = compileNode(scene)
  const bytecodeStr = bytecodeArray.join(', ')
  const programLength = bytecodeArray.length
  const maxProgramLength = MAX_BYTECODE_LENGTH

  // Build the WGSL code as a template string.
  var wgslCode = `
  ${
    compile_static && use_babylon_uniform_init
      ? `
    // const shader_bytecode = new Float32Array([${bytecodeArray.join(', ')}])
    // effect.setFloatArray('program', shader_bytecode)
    `
      : ''
  }
  // Auto-generated WGSL code with material and shape index tracking

///////////////////////////////////////////
// Structures and Bytecode Definition
///////////////////////////////////////////

struct SdResult {
  dist:   f32,
  normal: vec3<f32>,
  ao:     f32,
  color:  vec4<f32>,
  shapeID:u32,
};



${
  compile_static && !use_babylon_uniform_init
    ? `//Flat bytecode program.
const programLength = ${programLength}u;
var<private> program = array<f32, ${programLength}>(${bytecodeStr});`
    : ''
}

///////////////////////////////////////////
// Opcode Definitions
///////////////////////////////////////////

${Object.entries(opMap)
  .filter(([k, v]) => scene_ops.has(k))
  .map(([fn, number]) => `const OP_${toUpperSnakeCase(fn)} : i32 = ${number};`)
  .join('\n')}

const OP_POP_CONTEXT : i32 = ${opMap.popContext};

///////////////////////////////////////////
// Runtime Stacks and Context
///////////////////////////////////////////

// distance‐only evaluation
var<private> evalStack      : array<f32, 16>;
var<private> stackPtr       : i32 = 0;

// material + shapeID
var<private> resultStack    : array<SdResult, 16>;
var<private> resultStackPtr : i32 = 0;

// pack position.xyz + scale in .w
var<private> pointStack     : array<vec4<f32>, 16>;
var<private> ptStackPtr     : i32       = 0;

// current working point & its accumulated scale
var<private> currentP       : vec3<f32>;
var<private> currentScale   : f32       = 1.0;


///////////////////////////////////////////
// Generated Function Definitions
///////////////////////////////////////////

${Object.entries(SD_LIB)
  .map(([category_key, category]) =>
    Object.keys(category)
      .map((opName) => {
        if (!scene_ops.has(opName)) return
        let def = generateFunctionDef(SD_LIB[category_key][opName])
        return def
      })
      .filter(Boolean)
      .join('\n\n'),
  )
  .filter(Boolean)
  .join('\n\n')}
           

///////////////////////////////////////////
// Helper Functions for Struct Selection
///////////////////////////////////////////

fn selectSdResult(a: SdResult, b: SdResult, cond: bool) -> SdResult {
  var res: SdResult;
  if (cond) {
    res.dist = a.dist;
    res.color = a.color;
    res.shapeID = a.shapeID;
  } else {
    res.dist = b.dist;
    res.color = b.color;
    res.shapeID = b.shapeID;
  }
  return res;
}

///////////////////////////////////////////
// Original Raymarcher (Distance Only)
///////////////////////////////////////////

fn sdRpn(initialP: vec3<f32>) -> f32 {

  var pc: u32       = 0u;
  currentP          = initialP;
  ptStackPtr        = 0;
  stackPtr          = 0;
  currentScale      = 1.0;
  
  while (pc < uniforms.programLength) {
    let opcode = i32(uniforms.program[pc]);
    pc = pc + 1u;
    switch(opcode) {

      case OP_POP_CONTEXT: {
        ptStackPtr = ptStackPtr - 1;
        let packed   = pointStack[ptStackPtr];
        currentP     = packed.xyz;
        currentScale = packed.w;
        break;
      }
      ${Object.entries(opMap)
        .filter(([k, v]) => k.startsWith('sd') && scene_ops.has(k))
        .map(([fn, number]) => generateSwitchCaseBlock(SD_LIB.DISTANCE_FUNCTIONS[fn]))
        .join('\n')}
      ${Object.entries(opMap)
        .filter(([k, v]) => k in SD_LIB.BOOLEAN_OPS && scene_ops.has(k))
        .map(([fn, number]) => generateBooleanSwitchCaseBlock(SD_LIB.BOOLEAN_OPS[fn], false))
        .join('\n')}
      ${Object.entries(opMap)
        .filter(([k, v]) => scene_ops.has(k) && SD_LIB.POSITIONING_OPS[k])
        .map(([fn, number]) => generatePositioningSwitchCaseBlock(SD_LIB.POSITIONING_OPS[fn]))
        .join('\n')}
      default: { }
    }
  }
  let raw = evalStack[0];
  return raw * currentScale;
}

///////////////////////////////////////////
// Ambient‐Occlusion Helpers
///////////////////////////////////////////

fn hash(x: f32) -> f32 {
  return fract(sin(x * 127.1) * 43758.5453123);
}

fn randomSphereDir(rnd: vec2<f32>) -> vec3<f32> {
  let s = rnd.x * 6.28318530718;      // 2π
  let t = rnd.y * 2.0 - 1.0;          // cosθ
  return vec3<f32>(sin(s), cos(s), t) / sqrt(1.0 + t * t);
}

fn randomHemisphereDir(n: vec3<f32>, seed: f32) -> vec3<f32> {
  let rnd = vec2<f32>(hash(seed + 1.0), hash(seed + 2.0));
  let v   = randomSphereDir(rnd);
  return v * sign(dot(v, n));
}


///////////////////////////////////////////
// Material‐aware Raymarcher (with AO & normal)
///////////////////////////////////////////

fn sdRpnMaterial(initialP: vec3<f32>) -> SdResult {
  var pc: u32           = 0u;
  currentP              = initialP;
  ptStackPtr            = 0;
  resultStackPtr        = 0;
  currentScale          = 1.0;

  
  while (pc < uniforms.programLength) {
    let opcode = i32(uniforms.program[pc]);
    pc = pc + 1u;
    switch(opcode) {
  
        case OP_POP_CONTEXT: {
        ptStackPtr = ptStackPtr - 1;
        let packed   = pointStack[ptStackPtr];
        currentP     = packed.xyz;
        currentScale = packed.w;
        break;
      }
     ${Object.entries(opMap)
       .filter(([k, v]) => k.startsWith('sd') && scene_ops.has(k))
       .map(([fn, number]) => generateSwitchCaseBlock(SD_LIB.DISTANCE_FUNCTIONS[fn], true))
       .join('\n')}
      ${Object.entries(opMap)
        .filter(([k, v]) => k in SD_LIB.BOOLEAN_OPS && scene_ops.has(k))
        .map(([fn, number]) => generateBooleanSwitchCaseBlock(SD_LIB.BOOLEAN_OPS[fn], true))
        .join('\n')}
      ${Object.entries(opMap)
        .filter(([k, v]) => scene_ops.has(k) && SD_LIB.POSITIONING_OPS[k])
        .map(([fn, number]) => generatePositioningSwitchCaseBlock(SD_LIB.POSITIONING_OPS[fn]))
        .join('\n')}
      default: { }
    }
  }
   // pull out the raw result and apply the global scale
  var out = resultStack[0];

  // 1) compute world‐space normal by finite differences
  let eps: f32 = 1e-3;
  let nx = sdRpn(initialP + vec3<f32>(eps,0,0)) - sdRpn(initialP - vec3<f32>(eps,0,0));
  let ny = sdRpn(initialP + vec3<f32>(0,eps,0)) - sdRpn(initialP - vec3<f32>(0,eps,0));
  let nz = sdRpn(initialP + vec3<f32>(0,0,eps)) - sdRpn(initialP - vec3<f32>(0,0,eps));
  let N  = normalize(vec3<f32>(nx, ny, nz));

  // 2) hemisphere AO in local SDF‐space
  let NUM_SAMPLES: i32 = 16;
  let MAX_DIST:    f32 = 0.1;
  let invNum:      f32 = 1.0 / f32(NUM_SAMPLES);
  let rad:         f32 = 1.0 - invNum;
  var aoAcc:       f32 = 0.0;

  for (var i: i32 = 0; i < NUM_SAMPLES; i = i + 1) {
    let fi: f32 = f32(i);
    let l  = hash(fi) * MAX_DIST;
    let hemi = randomHemisphereDir(N, fi);
    let dir  = normalize(N + hemi * rad);
    // sample in *local* space
    let d = max(sdRpn(initialP + dir * l), 0.0);
    aoAcc = aoAcc + (l - d) / MAX_DIST;
  }
  let ao = clamp(1.0 - aoAcc * invNum, 0.0, 1.0);

  // 3) write back into the result
  out.normal = N;
  out.ao     = ao;
  return out;
}
`
  if (compile_static) wgslCode = wgslCode.replaceAll('uniforms.program', 'settings.program')
  explainBytecode(bytecodeArray, opMap)
  // console.log(wgslCode)
  return { code: wgslCode, program: bytecodeArray, programLength }
}

function toUpperSnakeCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // insert _ between lowercase and uppercase
    .toUpperCase()
}

function floatCountForType(type) {
  switch (type) {
    case 'f32':
      return 1
    case 'vec2f':
      return 2
    case 'vec3f':
      return 3
    case 'vec4f':
      return 4
    case 'mat4x4<f32>':
      return 16
    default:
      console.warn(`Unknown float count for '${type}'.`)
      return 1
  }
}

/**
 * Given an operation definition object,
 * generate a WGSL switch-case block string for the corresponding operation.
 *
 * Expected format for the operation definition:
 *
 * {
 *    "title": "Sphere",
 *    "fn_name": "sdSphere",
 *    "extra_info": "exact",
 *    "args": {
 *         "p": "vec3f",
 *         "r": "f32"
 *    },
 *    "returns": "f32",
 *    "body": "return length(p) - r;",
 *    "thumb": ""
 * }
 *
 * The convention here is that if an argument is named "p" and is a "vec3f",
 * then its value is taken from the WGSL variable `currentP` (i.e. implicit).
 * Otherwise the value is read from the flat bytecode array "program".
 * Depending on the argument’s type the correct number of floats is extracted.
 *
 * For a "leaf" shape function such as sdSphere, the compiled data may include extra
 * values (e.g. for material and an auto-generated shape id). In that case an extra skip of
 * 5 floats is inserted.
 *
 * The generated code also calls the function and then pushes the return value onto
 * either evalStack (if "f32") or resultStack (if a structure) accordingly.
 */

function generateSwitchCaseBlock(operation, mat_variant = false) {
  // Helper: determine how many program-floats a type consumes.

  // Start building the switch-case block.
  // We assume the opcode constant is named using the operation function name in uppercase.
  const opConstant = `OP_${toUpperSnakeCase(operation.fn_name)}`
  const codeLines = []
  codeLines.push(`case ${opConstant}: {`)

  // Array to collect the parameters that will be passed to the function call.
  const callArguments = []

  // Process each argument in the order provided.
  // (In modern JavaScript, the order of keys is preserved as inserted.)
  for (const [argName, argType] of Object.entries(operation.args)) {
    if (argName === 'p' && argType === 'vec3f') {
      // implicit
      callArguments.push('currentP')
    } else {
      // read any scalar/vector/matrix uniformly
      codeLines.push(readUniform(argType, argName))
      callArguments.push(argName)
    }
  }

  // Special handling: if this operation is a leaf shape (here we use sdSphere as our example),
  // then after reading its arguments, we also need to skip over the 5 extra floats (e.g. material and shapeID).
  // In a more general solution, you might have an extra flag or convention to trigger this.
  if (mat_variant) {
    codeLines.push(`
        ${new Array(MAT_SIZE - 1)
          .fill(0)
          .map((e, i) => `let m${i} = uniforms.program[pc + ${i}u];`)
          .join('\n        ')}
        pc = pc + ${MAT_SIZE - 1}u;
        let shape_id_f = uniforms.program[pc];
        pc = pc + 1u;
        let shape_id = u32(shape_id_f);`)
  } else {
    codeLines.push(`  // Skip over material and shape id.`)
    codeLines.push(`  pc = pc + ${MAT_SIZE}u;`)
  }

  // Build the function call.
  // If the return type is "f32", the result is pushed onto the evalStack.
  // Otherwise, assume it returns a structured value (e.g. SdResult) and push it onto the resultStack.

  if (mat_variant) {
    // compute in local space…
    codeLines.push(`  let d_local = ${operation.fn_name}(${callArguments.join(', ')});`)
    // …then convert to world space
    codeLines.push(`  let d = d_local * currentScale;`)
    codeLines.push(
      `  resultStack[resultStackPtr] = SdResult(d, vec3<f32>(0.0, 0.0, 0.0), 1.0, vec4<f32>(m0, m1, m2, m3), shape_id);`,
    )
    codeLines.push(`  resultStackPtr = resultStackPtr + 1;`)
  } else {
    // compute in local space…
    codeLines.push(`  let d_local = ${operation.fn_name}(${callArguments.join(', ')});`)
    // …then convert to world space
    codeLines.push(`  let d = d_local * currentScale;`)
    codeLines.push(`  evalStack[stackPtr] = d;`)
    codeLines.push(`  stackPtr = stackPtr + 1;`)
  }

  // Optionally include a break statement for clarity.
  codeLines.push(`  break;`)
  codeLines.push(`}`)

  // Return the complete switch-case block as a string.
  return codeLines.join('\n')
}
function generateBooleanSwitchCaseBlock(def, matVariant = false) {
  const OPC = `OP_${toUpperSnakeCase(def.fn_name)}`
  const extraArgs = Object.keys(def.args).filter((a) => a !== 'd1' && a !== 'd2')
  const hasParam = extraArgs.length === 1
  const paramName = hasParam ? extraArgs[0] : null
  const name = def.fn_name

  // categorize
  const isUnion =
    name.endsWith('Union') && !name.startsWith('opSmooth') && !name.startsWith('opChamfer')
  const isSubtract =
    name.endsWith('Subtract') && !name.startsWith('opSmooth') && !name.startsWith('opChamfer')
  const isIntersect =
    name.endsWith('Intersect') && !name.startsWith('opSmooth') && !name.startsWith('opChamfer')
  const isChamfer = name.startsWith('opChamfer')
  const isSmooth = name.startsWith('opSmooth')

  const loadParam = hasParam ? `let p0 = uniforms.program[pc];\n  pc += 1u;` : ``

  if (!matVariant) {
    return `
case ${OPC}: {
  ${ hasParam
      ? `let p0: f32 = uniforms.program[pc]; pc = pc + 1u;
         let k: f32  = p0 * currentScale;`
      : ''
  }
  // pop two distances
  stackPtr = stackPtr - 1;
  let b = evalStack[stackPtr];
  stackPtr = stackPtr - 1;
  let a = evalStack[stackPtr];

  // compute with scaled blend-radius
  let res = ${name}(a, b${hasParam ? ', k' : ''});
  evalStack[stackPtr] = res;
  stackPtr = stackPtr + 1;
  break;
}
`
  }

  if (matVariant) {
  return `
case ${OPC}: {
  // --- read & scale the raw blend/chamfer radius ---
  ${hasParam
    ? `let p0: f32 = uniforms.program[pc]; pc = pc + 1u;
       let k:  f32 = p0 * currentScale;`
    : ''
  }

  // --- pop the two SdResults ---
  resultStackPtr = resultStackPtr - 1;
  let rb = resultStack[resultStackPtr];
  resultStackPtr = resultStackPtr - 1;
  let ra = resultStack[resultStackPtr];

  // --- compute the world-space distance with scaled k ---
  let dist = ${def.fn_name}(
    ra.dist,
    rb.dist${hasParam ? ', k' : ''}
  );

  // --- pick color & shapeID, now using k in chamfer/smooth ---
  var color: vec4<f32>;
  var id:    u32;

  ${isUnion ? `// exact union
  color = select(rb.color, ra.color, ra.dist < rb.dist);
  id    = select(rb.shapeID, ra.shapeID, ra.dist < rb.dist);` : ''}

  ${isSubtract ? `// exact subtract
  color = ra.color;
  id    = ra.shapeID;` : ''}

  ${isIntersect ? `// exact intersect
  color = select(ra.color, rb.color, ra.dist < rb.dist);
  id    = select(ra.shapeID, rb.shapeID, ra.dist < rb.dist);` : ''}

  ${isChamfer ? `// chamfer union/subtract/intersect
  let baseWin  = ra.dist < rb.dist;
  let chamWin  = min(ra.dist, rb.dist)
               < (ra.dist ${name.includes('Subtract') ? '+' : '-'} k + rb.dist) * 0.5;
  color = select(
    select(rb.color, ra.color, baseWin),
    select(rb.color, ra.color, baseWin),
    chamWin
  );
  id    = select(
    select(rb.shapeID, ra.shapeID, baseWin),
    select(rb.shapeID, ra.shapeID, baseWin),
    chamWin
  );` : ''}

  ${isSmooth ? `// smooth union/subtract/intersect
  let h = clamp(
    0.5 + 0.5 * (rb.dist - ra.dist) / k,
    0.0, 1.0
  );
  color = mix(rb.color, ra.color, h);
  id    = select(rb.shapeID, ra.shapeID, ra.dist < rb.dist);` : ''}

  // --- push the blended result back on the stack ---
  resultStack[resultStackPtr] = SdResult(
    dist,
    vec3<f32>(0.0, 0.0, 0.0),
    1.0,
    color,
    id
  );
  resultStackPtr = resultStackPtr + 1;
  break;
}
`
}
}

function generatePositioningSwitchCaseBlock(def) {
  const fnName = def.fn_name;
  const OPC    = `OP_${toUpperSnakeCase(fnName)}`;
  const args   = Object.entries(def.args).filter(([n]) => n !== 'p');

  return `
case ${OPC}: {
  // 1) read all arguments
  ${args.map(([name, type]) => readUniform(type, name)).join('\n  ')}

  // 2) push the old (point,scale) onto the context stack
  pointStack[ptStackPtr] = vec4<f32>(currentP, currentScale);
  ptStackPtr = ptStackPtr + 1;

  // 3) apply warp & accumulate scale
  ${
    fnName === 'opScale'
      ? `// uniform scale
  currentP = currentP / s;
  currentScale = currentScale * s;`
      : fnName === 'opTransform'
      ? `// inverse transform (matrix is world→local)
  currentP = opTransform(currentP, transform);
  // extract inverse‐scale from the first column
  let invS = length(transform[0].xyz);
  let s    = 1.0 / invS;
  currentScale = currentScale * s;`
      : `// generic warp (e.g. opTranslate, op90RotateX…)
  currentP = ${fnName}(currentP${
        args.length ? ', ' + args.map(([n]) => n).join(', ') : ''
      });`
  }
  break;
}`
}


/**
 * Emit WGSL code lines to read `name` of given `type` from uniforms.program[pc..]
 * and advance pc accordingly.
 */
function readUniform(type, name) {
  const { count, ctor } = getTypeInfo(type)
  const lines = []
  if (count === 1) {
    lines.push(`  let ${name}: f32 = uniforms.program[pc];`)
  } else {
    // build the component list
    const comps = Array.from({ length: count }, (_, i) => `uniforms.program[pc + ${i}u]`).join(', ')
    lines.push(`  let ${name}: ${ctor} = ${ctor}(${comps});`)
  }
  lines.push(`  pc = pc + ${count}u;`)
  return lines.join('\n')
}
