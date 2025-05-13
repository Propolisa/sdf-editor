 /**
* Given a WGSL type string, return how many floats it consumes
* and what constructor to use (for vec/mat).
*/ 

import SD_LIB from "./sd-lib"

export function getTypeInfo(type) {
 // scalar
 if (type === 'f32') return { count: 1, ctor: null }
 // vec2f, vec3f, vec4f
 let m
 if ((m = type.match(/^vec([234])f$/))) {
   const n = +m[1]
   return { count: n, ctor: `vec${n}<f32>` }
 }
 // matNxM<f32>
 if ((m = type.match(/^mat(\d)x(\d)<f32>$/))) {
   const [_, R, C] = m.map(Number)
   return { count: R * C, ctor: `mat${R}x${C}<f32>` }
 }
 console.warn(`Unknown type: ${type}, defaulting to 1 float.`)
 return { count: 1, ctor: null }
}


/**
 * explainBytecode(bytecodeArray) → string
 * Produces an indented, nested view of your RPN bytecode.
 */
export function explainBytecode(bytecodeArray, opMap) {
    // invert the opMap
    const inv = Object.fromEntries(
      Object.entries(opMap).map(([k,v]) => [v, k])
    );
  
    let out = [];
    let indent = 0;
    let i = 0;
  
    while (i < bytecodeArray.length) {
      const code = bytecodeArray[i++];
      const opName = inv[code] ?? `UNKNOWN(${code})`;
  
      // 1) positioning‐ops push a new context
      if (SD_LIB.POSITIONING_OPS[opName]) {
        const def = SD_LIB.POSITIONING_OPS[opName].args;
        let args = [];
        for (let argName in def) {
          if (argName === "p") continue;
          const { count } = getTypeInfo(def[argName]);
          args.push(...bytecodeArray.slice(i, i + count));
          i += count;
        }
        out.push(`${"  ".repeat(indent)}${opName}(${args.join(", ")}) {`);
        indent++;
        continue;
      }
  
      // 2) popContext closes a block
      if (code === opMap.popContext) {
        indent = Math.max(0, indent - 1);
        out.push(`${"  ".repeat(indent)}}`);
        continue;
      }
  
      // 3) boolean ops
      if (SD_LIB.BOOLEAN_OPS[opName]) {
        const extra = booleanExtraCount(opName);
        let args = [];
        if (extra === 1) {
          args.push(bytecodeArray[i]);
          i++;
        }
        out.push(`${"  ".repeat(indent)}${opName}${args.length ? `(${args.join(", ")})` : ""}`);
        continue;
      }
  
      // 4) leaf distance/displacement/primitive
      if (SD_LIB.DISTANCE_FUNCTIONS[opName] || SD_LIB.DISPLACEMENT_OPS[opName]) {
        const def = SD_LIB.DISTANCE_FUNCTIONS[opName] || SD_LIB.DISPLACEMENT_OPS[opName];
        let args = [];
        for (let [argName, type] of Object.entries(def.args)) {
          if (argName === "p") continue;
          const { count } = getTypeInfo(type);
          args.push(...bytecodeArray.slice(i, i + count));
          i += count;
        }
        // read material RGBA + shapeID
        const rgba = bytecodeArray.slice(i, i + 4).join(", ");
        i += 4;
        const id = bytecodeArray[i++];
        out.push(
          `${"  ".repeat(indent)}${opName}(${args.join(", ")})  // color=[${rgba}] id=${id}`
        );
        continue;
      }
  
      // 5) anything else (e.g. stand-alone ops)
      out.push(`${"  ".repeat(indent)}${opName}()`);
    }
  
    return out.join("\n");
  }

  
// how many floats a boolean-op extra param takes
function booleanExtraCount(opName) {
  const args = SD_LIB.BOOLEAN_OPS[opName].args;
  const extras = Object.keys(args).filter(a => a!=="d1" && a!=="d2");
  return extras.length === 1 ? 1 : 0;
}