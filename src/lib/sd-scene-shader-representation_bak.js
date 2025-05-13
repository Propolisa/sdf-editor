import SD_LIB from "./sd-lib"
import { MAX_BYTECODE_LENGTH, MAT_SIZE } from "./defaults";


function generateFunctionDef(libEntry) {
    const args = Object.entries(libEntry.args)
        .map(([name, type]) => `${name}: ${type}`)
        .join(", ");
    return `fn ${libEntry.fn_name}(${args}) -> ${libEntry.returns} {
  ${libEntry.body}
}`;
}

export function generateWGSL(scene) {

    scene = scene.root
    let scene_ops = new Set()
    for (let key of Object.keys(SD_LIB.DISTANCE_FUNCTIONS)){
        scene_ops.add(key)
    }
    for (let key of Object.keys(SD_LIB.POSITIONING_OPS)){
        scene_ops.add(key)
    }
    for (let key of Object.keys(SD_LIB.BOOLEAN_OPS)){
        scene_ops.add(key)
    }
    function collectUsageDetails(node) {
        scene_ops.add(node.op);
        if (node.children) {
            node.children.forEach(child => collectUsageDetails(child));
        }
        if (node.modifiers){
            node.modifiers.forEach(modifier => scene_ops.add(modifier.op))
        }
    }
    collectUsageDetails(scene);

    // Mapping of operation names to numeric opcodes.
    // Ranges:
    //   [0,100): shapes
    //   [100,200): operators (point warping, if any)
    //   [200,300): booleans (operate on distance values)
    //   [300,+): program instructions (stack/context management)
    // start your boolean opcode base at 200
    const booleanBase = 200;
const displacementBase = 300;
const positioningBase = 400;
    const opMap = {
        // Shapes:
        ...Object.fromEntries(Object.keys(SD_LIB.DISTANCE_FUNCTIONS).map((op, i) => [op, i])),
        // Operators:
        infiniteRepetition: 100,
        // Booleans:
        ...Object.keys(SD_LIB.BOOLEAN_OPS).reduce((m, opName, idx) => {
            m[opName] = booleanBase + idx;
            return m;
        }, {}),
        ...Object.keys(SD_LIB.DISPLACEMENT_OPS).reduce((m, opName, idx) => {
            m[opName] = displacementBase + idx;
            return m;
        }, {}),
        ...Object.keys(SD_LIB.POSITIONING_OPS).reduce((m, opName, idx) => {
            m[opName] = positioningBase + idx;
            return m;
        }, {}),
        // Context management:
        pushTranslate: 300,
        popContext: 301,
    };

    function compileNode(node) {
        let bytecode = [];

            // 1) Modifiers: any point‐warp / positioning op or repetition
        if (node.modifiers?.length) {
            for (const mod of node.modifiers) {
                // — Positioning ops (opTranslate, op90RotateX, …):
                const posDef = SD_LIB.POSITIONING_OPS[mod.op];
                if (posDef) {
                    // push the opcode
                    bytecode.push(opMap[mod.op]);
                    // then each of its args (in declaration order, skipping 'p')
                    for (const [argName] of Object.entries(posDef.args)) {
                        if (argName === 'p') continue;
                        const v = mod.args[argName];
                        if (Array.isArray(v)) bytecode.push(...v);
                        else bytecode.push(v);
                    }
                }
            }
        }

        // 2) Boolean operators (union, subtract, intersect, chamfer, smooth…)
        const boolDef = SD_LIB.BOOLEAN_OPS[node.op];
        if (boolDef && node.children?.length > 0) {
            // We compile RPN style: child₀, child₁, OP, child₂, OP, …
            // So start with first child
            let acc = compileNode(node.children[0]);

            // For each subsequent child, compile it, then emit the operator + its extra param if any
            for (let i = 1; i < node.children.length; i++) {
                acc = acc.concat(compileNode(node.children[i]));
                acc.push(opMap[node.op]);
                // if this boolean op takes an extra float (e.g. 'k' or 'r'), push it now:
                const extraKeys = Object.keys(boolDef.args).filter(a => 'd1,d2'.split(',').indexOf(a) === -1);
                if (extraKeys.length === 1) {
                    const v = node.args?.[extraKeys[0]];
                    acc.push(Array.isArray(v) ? v[0] : v);
                }
            }

            bytecode = bytecode.concat(acc);

        } else {
            // 3) Non‐boolean: first compile any children (e.g. a “transform then leaf” pattern)
            if (node.children?.length) {
                for (const child of node.children) {
                    bytecode = bytecode.concat(compileNode(child));
                }
            }

            // 4) Leaf ops: distance functions, displacements, primitives…
            const fnDef = SD_LIB.DISTANCE_FUNCTIONS[node.op]
                || SD_LIB.DISPLACEMENT_OPS[node.op]
                || SD_LIB.POSITIONING_OPS[node.op]
                || SD_LIB.PRIMITIVE_OPS[node.op];

            if (fnDef) {
                // push the opcode
                bytecode.push(opMap[node.op]);

                // push each argument in declaration order (skip the implicit 'p')
                for (const [argName, _type] of Object.entries(fnDef.args)) {
                    if (argName === 'p') continue;
                    const val = node.args?.[argName];
                    if (Array.isArray(val)) bytecode.push(...val);
                    else if (val !== undefined) bytecode.push(val);
                    else throw new Error(`Missing arg ${argName} for ${node.op}`);
                }

                // push material rgba + shapeID
                const { r = 1, g = 1, b = 1, a = 1 } = node.material || {};
                bytecode.push(r, g, b, a);

                const id = node.id
                bytecode.push(id);

            } else if (opMap[node.op] != null) {
                // some other single‐token op
                bytecode.push(opMap[node.op]);

            } else {
                console.warn(`Unknown op in compileNode: ${node.op}`);
            }
        }

        // 5) Pop context for each modifier
        if (node.modifiers?.length) {
            for (let i = 0; i < node.modifiers.length; i++) {
                bytecode.push(opMap.popContext);
            }
        }

        return bytecode;
    }



    const bytecodeArray = compileNode(scene);
    const bytecodeStr = bytecodeArray.join(', ');
    const programLength = bytecodeArray.length;
    const maxProgramLength = MAX_BYTECODE_LENGTH

    // Build the WGSL code as a template string.
    const wgslCode =
        `// Auto-generated WGSL code with material and shape index tracking

///////////////////////////////////////////
// Structures and Bytecode Definition
///////////////////////////////////////////

struct SdResult {
  dist: f32,
  color: vec4<f32>,
  shapeID: u32,
};


// // Flat bytecode program.
// const program : array<f32, ${maxProgramLength}> = array<f32, ${maxProgramLength}>(${bytecodeStr});

///////////////////////////////////////////
// Opcode Definitions
///////////////////////////////////////////

${Object.entries(opMap).filter(([k, v]) => (k.startsWith("sd") || k.startsWith("op")) && scene_ops.has(k)).map(([fn, number]) => `const OP_${toUpperSnakeCase(fn)} : i32 = ${number};`).join("\n")}

// const OP_INFINITE_REPETITION : i32 = ${opMap.infiniteRepetition};
// const OP_UNION : i32 = ${opMap.opUnion};
// const OP_SUBTRACT : i32 = ${opMap.opSubtract};
// const OP_SMOOTH_UNION : i32 = ${opMap.opSmoothUnion};
// const OP_SMOOTH_SUBTRACT : i32 = ${opMap.opSmoothSubtract};
// const OP_PUSH_TRANSLATE : i32 = ${opMap.pushTranslate};
const OP_POP_CONTEXT : i32 = ${opMap.popContext};

///////////////////////////////////////////
// Runtime Stacks and Context
///////////////////////////////////////////

// Distance-only evaluation stack.
var<private> evalStack : array<f32, 64>;
var<private> stackPtr : i32 = 0;

// Result stack for material and shape index tracking.
var<private> resultStack : array<SdResult, 64>;
var<private> resultStackPtr : i32 = 0;

var<private> scaleStack   : array<f32, 16>;
var<private> scalePtr     : i32 = 0;
var<private> currentScale : f32 = 1.0;

// Stack for point transformations.
var<private> pointStack : array<vec3<f32>, 16>;
var<private> ptStackPtr : i32 = 0;

// The current working point.
var<private> currentP : vec3<f32>;

///////////////////////////////////////////
// Generated Function Definitions
///////////////////////////////////////////

${Object.entries(SD_LIB).map(([category_key, category]) =>
            Object.keys(category).map(opName => {
                if (!(scene_ops.has(opName))) return
                let def = generateFunctionDef(SD_LIB[category_key][opName]);
                return def;
            }).filter(Boolean).join("\n\n")).filter(Boolean).join("\n\n")
        }
           

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


  var pc: u32 = 0u;
  currentP = initialP;
  ptStackPtr = 0;
  stackPtr = 0;
  
  while (pc < uniforms.programLength) {
    let opcode = i32(uniforms.program[pc]);
    pc = pc + 1u;
    switch(opcode) {

    //   case OP_INFINITE_REPETITION: {
    //     let px = uniforms.program[pc];
    //     let py = uniforms.program[pc + 1u];
    //     let pz = uniforms.program[pc + 2u];
    //     pc = pc + 3u;
    //     pointStack[ptStackPtr] = currentP;
    //     ptStackPtr = ptStackPtr + 1;
    //     currentP = opInfArray(currentP, vec3<f32>(px, py, pz));
    //   }
      case OP_POP_CONTEXT: {
        ptStackPtr = ptStackPtr - 1;
        currentP = pointStack[ptStackPtr];
      }
      ${Object.entries(opMap).filter(([k, v]) => k.startsWith("sd") && scene_ops.has(k)).map(([fn, number]) => generateSwitchCaseBlock(SD_LIB.DISTANCE_FUNCTIONS[fn])).join("\n")}
      ${Object.entries(opMap).filter(([k, v]) => k in SD_LIB.BOOLEAN_OPS && scene_ops.has(k))
            .map(([fn, number]) => generateBooleanSwitchCaseBlock(SD_LIB.BOOLEAN_OPS[fn], false)).join("\n")}
      ${Object.entries(opMap)
            .filter(([k,v]) => scene_ops.has(k) && SD_LIB.POSITIONING_OPS[k])
            .map(([fn,number]) => generatePositioningSwitchCaseBlock(SD_LIB.POSITIONING_OPS[fn]))
            .join("\n")}
      default: { }
    }
  }
  return evalStack[0];
}

///////////////////////////////////////////
// New Raymarcher: Returns Material and Pickable Shape ID
///////////////////////////////////////////

fn sdRpnMaterial(initialP: vec3<f32>) -> SdResult {

  var pc: u32 = 0u;
  currentP = initialP;
  ptStackPtr = 0;
  resultStackPtr = 0;
  
  while (pc < uniforms.programLength) {
    let opcode = i32(uniforms.program[pc]);
    pc = pc + 1u;
    switch(opcode) {
    //   case OP_PUSH_TRANSLATE: {
    //     let tx = uniforms.program[pc];
    //     let ty = uniforms.program[pc + 1u];
    //     let tz = uniforms.program[pc + 2u];
    //     pc = pc + 3u;
    //     pointStack[ptStackPtr] = currentP;
    //     ptStackPtr = ptStackPtr + 1;
    //     currentP = currentP - vec3<f32>(tx, ty, tz);
    //   }
    //   case OP_INFINITE_REPETITION: {
    //     let px = uniforms.program[pc];
    //     let py = uniforms.program[pc + 1u];
    //     let pz = uniforms.program[pc + 2u];
    //     pc = pc + 3u;
    //     pointStack[ptStackPtr] = currentP;
    //     ptStackPtr = ptStackPtr + 1;
    //     currentP = opInfArray(currentP, vec3<f32>(px, py, pz));
    //   }
    case OP_OP_SCALE_DIST: {
        let s = uniforms.program[pc];
        pc = pc + 1u;
        // scale the *top* of the distance stack
        let idx = stackPtr - 1;
        evalStack[idx] = evalStack[idx] * s;
        break;
        }
      case OP_POP_CONTEXT: {
        ptStackPtr = ptStackPtr - 1;
        currentP = pointStack[ptStackPtr];
      }
     ${Object.entries(opMap).filter(([k, v]) => k.startsWith("sd") && scene_ops.has(k))
            .map(([fn, number]) => generateSwitchCaseBlock(SD_LIB.DISTANCE_FUNCTIONS[fn], true)).join("\n")}
      ${Object.entries(opMap).filter(([k, v]) => k in SD_LIB.BOOLEAN_OPS && scene_ops.has(k))
            .map(([fn, number]) => generateBooleanSwitchCaseBlock(SD_LIB.BOOLEAN_OPS[fn], true)).join("\n")}
      ${Object.entries(opMap)
    .filter(([k,v]) => scene_ops.has(k) && SD_LIB.POSITIONING_OPS[k])
    .map(([fn,number]) => generatePositioningSwitchCaseBlock(SD_LIB.POSITIONING_OPS[fn]))
    .join("\n")}
      default: { }
    }
  }
  return resultStack[0];
}
`;
    // console.log(wgslCode)
    return { code: wgslCode, program: bytecodeArray, programLength };
}

function toUpperSnakeCase(name) {
    return name
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // insert _ between lowercase and uppercase
        .toUpperCase();
}

function floatCountForType(type) {
    switch (type) {
        case "f32":
            return 1;
        case "vec2f":
            return 2;
        case "vec3f":
            return 3;
        case "vec4f":
            return 4;
        case "mat4x4<f32>":
            return 16;
        default:
            console.warn(`Unknown float count for '${type}'.`)
            return 1;
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
    const opConstant = `OP_${toUpperSnakeCase(operation.fn_name)}`;
    const codeLines = [];
    codeLines.push(`case ${opConstant}: {`);

    // Array to collect the parameters that will be passed to the function call.
    const callArguments = [];

    // Process each argument in the order provided.
    // (In modern JavaScript, the order of keys is preserved as inserted.)
    for (const [argName, argType] of Object.entries(operation.args)) {
        // If argument is "p" of type "vec3f", use the implicit WGSL variable.
        if (argName === "p" && argType === "vec3f") {
            callArguments.push("currentP");
        } else {
            const count = floatCountForType(argType);
            if (count === 1) {
                // Single f32 value.
                codeLines.push(`  let ${argName} = uniforms.program[pc];`);
                codeLines.push(`  pc = pc + 1u;`);
            } else {
                // For vector types build a vec constructor
                const components = [];
                for (let i = 0; i < count; i++) {
                    components.push(`uniforms.program[pc + ${i}u]`);
                }
                codeLines.push(`  let ${argName} = vec${count}<f32>(${components.join(", ")});`);
                codeLines.push(`  pc = pc + ${count}u;`);
            }
            callArguments.push(argName);
        }
    }

    // Special handling: if this operation is a leaf shape (here we use sdSphere as our example),
    // then after reading its arguments, we also need to skip over the 5 extra floats (e.g. material and shapeID).
    // In a more general solution, you might have an extra flag or convention to trigger this.
    if (mat_variant) {
        codeLines.push(`
        ${new Array(MAT_SIZE - 1).fill(0).map((e, i) => `let m${i} = uniforms.program[pc + ${i}u];`).join("\n        ")}
        pc = pc + ${MAT_SIZE - 1}u;
        let shape_id_f = uniforms.program[pc];
        pc = pc + 1u;
        let shape_id = u32(shape_id_f);`)
    } else {
        codeLines.push(`  // Skip over material and shape id.`);
        codeLines.push(`  pc = pc + ${MAT_SIZE}u;`);
    }

    // Build the function call.
    // If the return type is "f32", the result is pushed onto the evalStack.
    // Otherwise, assume it returns a structured value (e.g. SdResult) and push it onto the resultStack.

    if (mat_variant) {
        codeLines.push(`  let d = ${operation.fn_name}(${callArguments.join(", ")});`);
        codeLines.push(`  resultStack[resultStackPtr] = SdResult(d, vec4<f32>(m0, m1, m2, m3), shape_id);`)
        codeLines.push(`  resultStackPtr = resultStackPtr + 1;`)

    } else {
        codeLines.push(`  let d = ${operation.fn_name}(${callArguments.join(", ")});`);
        codeLines.push(`  evalStack[stackPtr] = d;`);
        codeLines.push(`  stackPtr = stackPtr + 1;`);
    }



    // Optionally include a break statement for clarity.
    codeLines.push(`  break;`);
    codeLines.push(`}`);

    // Return the complete switch-case block as a string.
    return codeLines.join("\n");
}
function generateBooleanSwitchCaseBlock(def, matVariant = false) {
    const OPC = `OP_${toUpperSnakeCase(def.fn_name)}`;
    const extraArgs = Object.keys(def.args).filter(a => a !== 'd1' && a !== 'd2');
    const hasParam = extraArgs.length === 1;
    const paramName = hasParam ? extraArgs[0] : null;
    const name = def.fn_name;

    // categorize
    const isUnion = name.endsWith('Union') && !name.startsWith('opSmooth') && !name.startsWith('opChamfer');
    const isSubtract = name.endsWith('Subtract') && !name.startsWith('opSmooth') && !name.startsWith('opChamfer');
    const isIntersect = name.endsWith('Intersect') && !name.startsWith('opSmooth') && !name.startsWith('opChamfer');
    const isChamfer = name.startsWith('opChamfer');
    const isSmooth = name.startsWith('opSmooth');

    const loadParam = hasParam
        ? `let p0 = uniforms.program[pc];\n  pc += 1u;`
        : ``;

    if (!matVariant) {
        return `
case ${OPC}: {
  ${loadParam}
  // pop two distances
  stackPtr -= 1;
  let b = evalStack[stackPtr];
  stackPtr -= 1;
  let a = evalStack[stackPtr];
  // compute
  let res = ${def.fn_name}(a, b${hasParam ? ', p0' : ''});
  evalStack[stackPtr] = res;
  stackPtr += 1;
  break;
}
`;
    }

    // — material variant —
    return `
case ${OPC}: {
  ${loadParam}
  // pop two results
  resultStackPtr -= 1;
  let rb = resultStack[resultStackPtr];
  resultStackPtr -= 1;
  let ra = resultStack[resultStackPtr];

  // compute raw distance
  let dist = ${def.fn_name}(ra.dist, rb.dist${hasParam ? ', p0' : ''});

  // determine output color + ID
  var color: vec4<f32>;
  var id:    u32;

  ${isUnion ? `
    // exact union: pick nearer branch
    color = select(rb.color, ra.color, ra.dist < rb.dist);
    id    = select(rb.shapeID, ra.shapeID, ra.dist < rb.dist);
  ` : ''}

  ${isSubtract ? `
    // exact subtraction: always minuend
    color = ra.color;
    id    = ra.shapeID;
  ` : ''}

  ${isIntersect ? `
    // exact intersection: pick farther branch
    color = select(ra.color, rb.color, ra.dist < rb.dist);
    id    = select(ra.shapeID, rb.shapeID, ra.dist < rb.dist);
  ` : ''}

  ${isChamfer ? `
    // chamfer: min(d1,d2) vs blend‐region
    let baseWin = ra.dist < rb.dist;
    let chamWin = min(ra.dist, rb.dist) < (ra.dist - p0 + rb.dist) * 0.5;
    // if chamWin==false fallback to nearer
    color = select(select(rb.color, ra.color, baseWin),
                   select(rb.color, ra.color, baseWin),
                   chamWin);
    id    = select(select(rb.shapeID, ra.shapeID, baseWin),
                   select(rb.shapeID, ra.shapeID, baseWin),
                   chamWin);
  ` : ''}

  ${isSmooth ? `
    // smooth blend
    let h = clamp(0.5 + 0.5 * (rb.dist - ra.dist) / p0, 0.0, 1.0);
    color = mix(rb.color, ra.color, h);
    id    = select(rb.shapeID, ra.shapeID, ra.dist < rb.dist);
  ` : ''}

  // push back
  resultStack[resultStackPtr] = SdResult(dist, color, id);
  resultStackPtr += 1;
  break;
}
`;
}

function generatePositioningSwitchCaseBlock(def) {
  const OPC = `OP_${toUpperSnakeCase(def.fn_name)}`;
  const argEntries = Object.entries(def.args).filter(([name,_]) => name !== 'p');

  let lines = [];
  lines.push(`case ${OPC}: {`);
  // 1) read args from uniforms.program
  let callArgs = ["currentP"];
  let pcAdvance = 0;
  for (let [argName, argType] of argEntries) {
    const cnt = floatCountForType(argType);
    if (cnt === 1) {
      lines.push(`  let ${argName} = uniforms.program[pc];`);
      pcAdvance += 1;
    } else {
      const comps = Array.from({length:cnt}, (_,i) => `uniforms.program[pc + ${i}u]`).join(", ");
      lines.push(`  let ${argName} = vec${cnt}<f32>(${comps});`);
      pcAdvance += cnt;
    }
    callArgs.push(argName);
  }
  if (pcAdvance > 0) {
    lines.push(`  pc = pc + ${pcAdvance}u;`);
  }

  // 2) push old point on stack
  lines.push(`  pointStack[ptStackPtr] = currentP;`);
  lines.push(`  ptStackPtr = ptStackPtr + 1;`);

  // 3) warp currentP
  lines.push(`  currentP = ${def.fn_name}(${callArgs.join(", ")});`);

  lines.push(`  break;`, `}`);
  return lines.join("\n");
}