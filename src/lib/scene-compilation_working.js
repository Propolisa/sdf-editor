// compileScene.js

import SD_LIB, { CONTEXTUAL_ARGUMENTS } from './sd-lib.js'

/**
 * Emit a standalone helper function definition in GLSL or WGSL.
 */
export function emitFunction(fnDef, lang = 'wgsl') {
  const F = lang === 'glsl' ? fnDef.GLSL : fnDef
  const args =
    lang === 'glsl'
      ? Object.entries(F.args)
        .map(([n, t]) => `${t} ${n}`)
        .join(', ')
      : Object.entries(F.args)
        .map(([n, t]) => `${n}: ${t}`)
        .join(', ')
  if (lang === 'glsl') {
    return `${F.returns} ${fnDef.fn_name}(${args}) {\n  ${F.body.replace(/\n/g, '\n  ')}\n}`
  } else {
    return `fn ${F.fn_name}(${args}) -> ${F.returns} {\n  ${F.body.replace(/\n/g, '\n  ')}\n}`
  }
}


/**
 * Compile a scene-graph into a single sdScene() function in GLSL or WGSL.
 */
export function compileScene(
  scene,
  lang = 'wgsl',
  include_referenced_fn_defs = true,
  with_materials = true
) {
  // Which ops produce float-only results?
  const BOOL_OPS = new Set([
    'opUnion', 'opSubtract', 'opIntersect',
    'opChamferUnion', 'opChamferSubtract', 'opChamferIntersect',
    'opSmoothUnion', 'opSmoothSubtract', 'opSmoothIntersect',
  ]);

  const wgslTernary = (cond, thenExpr, elseExpr, typeName) => {
    if (typeName === 'SdResult') {
      return `selectSdResult(${elseExpr}, ${thenExpr}, ${cond})`;
    } else {
      return `select(${elseExpr}, ${thenExpr}, ${cond})`;
    }
  };

  const glslTernary = (cond, thenExpr, elseExpr, typeName) => {
    if (typeName === 'SdResult') {
      return `selectSdResult(${thenExpr}, ${elseExpr}, ${cond})`;
    } else {
      return `(${cond} ? ${elseExpr} : ${thenExpr})`;
    }
  };

  // Printer definitions for both languages
  const printers = {
    wgsl: {

      header: (() => {
        let h = `// Auto-generated scene (with materials)

struct SdResult {
  dist:    f32,
  blend:   f32,
  normal:  vec3f,
  ao:      f32,
  color:   vec4f,
  shapeID: u32,
};

`;
        if (with_materials) {
          h += `
// Select between two SdResult values
fn selectSdResult(a: SdResult, b: SdResult, cond: bool) -> SdResult {
  if (cond) { return a; } else { return b; }
}

// UNION: pick the nearer
fn opUnionMat(a: SdResult, b: SdResult) -> SdResult {
  let closer = a.dist < b.dist;
  var result: SdResult = selectSdResult(a, b, closer);
  result.blend = ${wgslTernary('closer', '1.0', '0.0', 'f32')};
  return result;
}

// SUBTRACT: keep a, cut away b
fn opSubtractMat(a: SdResult, b: SdResult) -> SdResult {
  var result: SdResult = a;
  result.dist  = max(a.dist, -b.dist);
  result.blend = 0.0;
  return result;
}

// INTERSECT: pick the farther
fn opIntersectMat(a: SdResult, b: SdResult) -> SdResult {
  let farther = a.dist > b.dist;
  var result: SdResult = selectSdResult(a, b, farther);
  result.blend = ${wgslTernary('farther', '1.0', '0.0', 'f32')};
  return result;
}

// CHAMFER-UNION
fn opChamferUnionMat(a: SdResult, b: SdResult, r: f32) -> SdResult {
  let baseWin = a.dist < b.dist;
  let chamWin = min(a.dist, b.dist) < (a.dist - r + b.dist) * 0.5;
  let base    = selectSdResult(a, b, baseWin);
  let chamRes = SdResult(
    (a.dist - r + b.dist) * 0.5,
    0.5,
    vec3f(0.0),
    1.0,
    mix(a.color, b.color, 0.5),
    select(a.shapeID, b.shapeID, baseWin)
  );
  var result: SdResult = ${wgslTernary('chamWin', 'chamRes', 'base', 'SdResult')};
  result.blend        = ${wgslTernary('chamWin', '1.0', '0.0', 'f32')};
  return result;
}

// CHAMFER-SUBTRACT
fn opChamferSubtractMat(a: SdResult, b: SdResult, r: f32) -> SdResult {
  let baseWin = a.dist < b.dist;
  let chamWin = min(a.dist, b.dist) < (a.dist + r - b.dist) * 0.5;
  let base    = selectSdResult(a, b, baseWin);
  let chamRes = SdResult(
    (a.dist + r - b.dist) * 0.5,
    0.5,
    vec3f(0.0),
    1.0,
    mix(a.color, b.color, 0.5),
    select(a.shapeID, b.shapeID, baseWin)
  );
  var result: SdResult = ${wgslTernary('chamWin', 'chamRes', 'base', 'SdResult')};
  result.blend        = ${wgslTernary('chamWin', '1.0', '0.0', 'f32')};
  return result;
}

// CHAMFER-INTERSECT
fn opChamferIntersectMat(a: SdResult, b: SdResult, r: f32) -> SdResult {
  let baseWin = a.dist < b.dist;
  let chamWin = min(a.dist, b.dist) < (a.dist + r + b.dist) * 0.5;
  let base    = selectSdResult(a, b, baseWin);
  let chamRes = SdResult(
    (a.dist + r + b.dist) * 0.5,
    0.5,
    vec3f(0.0),
    1.0,
    mix(a.color, b.color, 0.5),
    select(a.shapeID, b.shapeID, baseWin)
  );
  var result: SdResult = ${wgslTernary('chamWin', 'chamRes', 'base', 'SdResult')};
  result.blend        = ${wgslTernary('chamWin', '1.0', '0.0', 'f32')};
  return result;
}

// SMOOTH-UNION
fn opSmoothUnionMat(a: SdResult, b: SdResult, k: f32) -> SdResult {
  let h = clamp(0.5 + 0.5 * (a.dist - b.dist) / k, 0.0, 1.0);
  let dist = mix(a.dist, b.dist, h) - k * h * (1.0 - h);
  return SdResult(dist, h, vec3f(0.0), 1.0, vec4f(0.0), 0u);
}

// SMOOTH-SUBTRACT
fn opSmoothSubtractMat(a: SdResult, b: SdResult, k: f32) -> SdResult {
  let h = clamp(0.5 - 0.5 * (a.dist + b.dist) / k, 0.0, 1.0);
  let dist = mix(a.dist, -b.dist, h) + k * h * (1.0 - h);
  return SdResult(dist, h, vec3f(0.0), 1.0, vec4f(0.0), 0u);
}

// SMOOTH-INTERSECT
fn opSmoothIntersectMat(a: SdResult, b: SdResult, k: f32) -> SdResult {
  let h = clamp(0.5 - 0.5 * (b.dist - a.dist) / k, 0.0, 1.0);
  let dist = mix(b.dist, a.dist, h) + k * h * (1.0 - h);
  return SdResult(dist, h, vec3f(0.0), 1.0, vec4f(0.0), 0u);
}
`;
        }
        return h;
      })(),

      funcStart: () =>
        with_materials
          ? `fn sdScene(p: vec3f) -> SdResult {`
          : `fn sdScene(p: vec3f) -> f32 {`,
      varDecl: (type, name, expr) => {
        switch (type) {
          case 'vec3': return `  var ${name}: vec3f = ${expr};`
          case 'vec4': return `  var ${name}: vec4f = ${expr};`
          case 'f32': return `  var ${name}: f32       = ${expr};`
          case 'u32': return `  var ${name}: u32       = ${expr};`
          case 'SdResult': return `  var ${name}: SdResult  = ${expr};`
          default: throw new Error(`Unknown varDecl type: ${type}`)
        }
      },
      assign: (name, expr) => `  ${name} = ${expr};`,
      ret: name => `  return ${name};`,
      ternary: wgslTernary,
      fmtVal: v => {
        if (typeof v === 'number') {
          let s = v.toFixed(6)
          if (!s.includes('.')) s += '.0'
          return s
        }
        if (Array.isArray(v) && v.length === 3)
          return `vec3f(${v.map(x => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 4)
          return `vec4f(${v.map(x => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 16)
          return `mat4x4f(${v.map(x => x.toFixed(6)).join(', ')})`
        throw new Error(`WGSL fmtVal can't handle ${JSON.stringify(v)}`)
      },
      call: (op, args) => `${op}(${args.join(', ')})`,
    },

    glsl: {
      header: (() => {
        let h = `// Auto-generated scene (with materials)

struct SdResult {
  float dist;
  float blend;
  vec3  normal;
  float ao;
  vec4  color;
  uint  shapeID;
};

`;
        if (with_materials) {
          h += `
// Select between two SdResult values
SdResult selectSdResult(SdResult a, SdResult b, bool cond) {
  if (cond) {
    return a;
  } else {
    return b;
  }
}

// UNION
SdResult opUnionMat(SdResult a, SdResult b) {
  bool closer = a.dist < b.dist;
  SdResult result = selectSdResult(a, b, closer);
  result.blend = ${glslTernary('closer', '0.0', '1.0', 'f32')};
  return result;
}

// SUBTRACT
SdResult opSubtractMat(SdResult a, SdResult b) {
  SdResult result = a;
  result.dist  = max(a.dist, -b.dist);
  result.blend = 0.0;
  return result;
}

// INTERSECT
SdResult opIntersectMat(SdResult a, SdResult b) {
  bool farther = a.dist > b.dist;
  SdResult result = selectSdResult(a, b, farther);
  result.blend = ${glslTernary('farther', '0.0', '1.0', 'f32')};
  return result;
}

// CHAMFER-UNION
SdResult opChamferUnionMat(SdResult a, SdResult b, float r) {
  bool baseWin = a.dist < b.dist;
  bool chamWin = min(a.dist, b.dist) < (a.dist - r + b.dist) * 0.5;
  SdResult base    = selectSdResult(a, b, baseWin);
  SdResult chamRes;
  chamRes.dist    = (a.dist - r + b.dist) * 0.5;
  chamRes.blend   = 0.5;
  chamRes.normal  = vec3(0.0);
  chamRes.ao      = 1.0;
  chamRes.color   = mix(a.color, b.color, 0.5);
  chamRes.shapeID = baseWin ? a.shapeID : b.shapeID;
  SdResult result = ${glslTernary('chamWin', 'chamRes', 'base', 'SdResult')};
  result.blend    = ${glslTernary('chamWin', '1.0', '0.0', 'f32')};
  return result;
}

// CHAMFER-SUBTRACT
SdResult opChamferSubtractMat(SdResult a, SdResult b, float r) {
  bool baseWin = a.dist < b.dist;
  bool chamWin = min(a.dist, b.dist) < (a.dist + r - b.dist) * 0.5;
  SdResult base    = selectSdResult(a, b, baseWin);
  SdResult chamRes;
  chamRes.dist    = (a.dist + r - b.dist) * 0.5;
  chamRes.blend   = 0.5;
  chamRes.normal  = vec3(0.0);
  chamRes.ao      = 1.0;
  chamRes.color   = mix(a.color, b.color, 0.5);
  chamRes.shapeID = baseWin ? a.shapeID : b.shapeID;
  SdResult result = ${glslTernary('chamWin', 'chamRes', 'base', 'SdResult')};
  result.blend    = ${glslTernary('chamWin', '1.0', '0.0', 'f32')};
  return result;
}

// CHAMFER-INTERSECT
SdResult opChamferIntersectMat(SdResult a, SdResult b, float r) {
  bool baseWin = a.dist < b.dist;
  bool chamWin = min(a.dist, b.dist) < (a.dist + r + b.dist) * 0.5;
  SdResult base    = selectSdResult(a, b, baseWin);
  SdResult chamRes;
  chamRes.dist    = (a.dist + r + b.dist) * 0.5;
  chamRes.blend   = 0.5;
  chamRes.normal  = vec3(0.0);
  chamRes.ao      = 1.0;
  chamRes.color   = mix(a.color, b.color, 0.5);
  chamRes.shapeID = baseWin ? a.shapeID : b.shapeID;
  SdResult result = ${glslTernary('chamWin', 'chamRes', 'base', 'SdResult')};
  result.blend    = ${glslTernary('chamWin', '1.0', '0.0', 'f32')};
  return result;
}

// SMOOTH-UNION
SdResult opSmoothUnionMat(SdResult a, SdResult b, float k) {
  float h = clamp(0.5 + 0.5 * (a.dist - b.dist) / k, 0.0, 1.0);
  float dist = mix(a.dist, b.dist, h) - k * h * (1.0 - h);
  return SdResult(dist, h, vec3(0.0), 1.0, vec4(0.0), 0u);
}

// SMOOTH-SUBTRACT
SdResult opSmoothSubtractMat(SdResult a, SdResult b, float k) {
  float h = clamp(0.5 - 0.5 * (a.dist + b.dist) / k, 0.0, 1.0);
  float dist = mix(a.dist, -b.dist, h) + k * h * (1.0 - h);
  return SdResult(dist, h, vec3(0.0), 1.0, vec4(0.0), 0u);
}

// SMOOTH-INTERSECT
SdResult opSmoothIntersectMat(SdResult a, SdResult b, float k) {
  float h = clamp(0.5 - 0.5 * (b.dist - a.dist) / k, 0.0, 1.0);
  float dist = mix(b.dist, a.dist, h) + k * h * (1.0 - h);
  return SdResult(dist, h, vec3(0.0), 1.0, vec4(0.0), 0u);
}
`;
        }
        return h;
      })(),

      funcStart: () =>
        with_materials
          ? `SdResult sdScene(vec3 p) {`
          : `float sdScene(vec3 p) {`,
      varDecl: (type, name, expr) => {
        switch (type) {
          case 'vec3': return `  vec3  ${name} = ${expr};`
          case 'vec4': return `  vec4  ${name} = ${expr};`
          case 'f32':
          case 'float': return `  float ${name} = ${expr};`
          case 'u32':
          case 'uint': return `  uint  ${name} = ${expr};`
          case 'SdResult': return `  SdResult ${name} = ${expr};`
          default: throw new Error(`Unknown varDecl type: ${type}`)
        }
      },
      assign: (name, expr) => `  ${name} = ${expr};`,
      ret: name => `  return ${name};`,
      ternary: glslTernary,
      fmtVal: v => {
        if (typeof v === 'number') {
          let s = v.toFixed(6)
          if (!s.includes('.')) s += '.0'
          return s
        }
        if (Array.isArray(v) && v.length === 3)
          return `vec3(${v.map(x => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 4)
          return `vec4(${v.map(x => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 16)
          return `mat4(${v.map(x => x.toFixed(6)).join(', ')})`
        throw new Error(`GLSL fmtVal can't handle ${JSON.stringify(v)}`)
      },
      call: (op, args) => `${op}(${args.join(', ')})`,
    },
  }

  const P = printers[lang] || printers.wgsl;


  let idCounter = 0;
  function unique(prefix) {
    return `${prefix}_${idCounter++}`;
  }

  // 1) Collect all ops used in the scene
  const functions_referenced = new Set();
  function collect(node) {
    functions_referenced.add(node.op);
    (node.modifiers || []).forEach(m => functions_referenced.add(m.op));
    (node.children || []).forEach(collect);
  }
  collect(scene);

  // 2) Emit each referenced helper function if requested
  const lines = [];
  if (include_referenced_fn_defs) {
    for (let op of functions_referenced) {
      const def = SD_LIB[op];
      if (!def) continue;
      lines.push(emitFunction(def, lang), '');
    }
  }

  // 3) Emit the language-specific header
  lines.push(P.header);

  // 4) Unified walk: handles both distance-only and material SdResult paths
  function walk(node, scale, inVar) {
    lines.push(`  // node ${node.name || node.op}`);
    const pVar = unique('p');
    lines.push(P.varDecl('vec3', pVar, inVar));

    // apply modifiers
    let s = scale;
    for (let mod of node.modifiers || []) {
      const def = SD_LIB[mod.op];
      const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set();
      const args = [pVar];
      for (let name of Object.keys(def.args)) {
        if (!ctx.has(name)) args.push(P.fmtVal(mod.args[name]));
      }
      lines.push(P.assign(pVar, P.call(mod.op, args)));
      if (mod.op === 'opScale') {
        s *= mod.args.s;
      } else if (mod.op === 'opTransform') {
        const inv = mod.args.transform[0];
        s *= 1 / inv;
      }
    }

    // leaf: primitive distance (+ material if enabled)
    if (node.op in SD_LIB.DISTANCE_FUNCTIONS) {
      const def = SD_LIB[node.op];
      const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set();
      const args = [pVar];
      for (let name of Object.keys(def.args)) {
        if (!ctx.has(name)) args.push(P.fmtVal(node.args[name]));
      }
      const dVar = unique('d');
      lines.push(P.varDecl('f32', dVar, P.call(node.op, args)));
      if (s !== 1.0) {
        lines.push(P.assign(dVar, `${dVar} * ${s.toFixed(6)}`));
      }

      if (!with_materials) {
        return dVar;
      }

      // material path
      const rVar = unique('r');
      const m = node.material || { r: 0, g: 0, b: 0, a: 1 };
      const col = P.fmtVal([m.r, m.g, m.b, m.a]);
      const id = node.id != null ? `${node.id}u` : '0u';
      lines.push(
        P.varDecl(
          'SdResult',
          rVar,
          `SdResult(${dVar}, 0.0, ${P.fmtVal([0, 0, 0])}, 1.0, ${col}, ${id})`
        )
      );
      return rVar;
    }

    // boolean / CSG / displacement
    const isBool = BOOL_OPS.has(node.op)
      || SD_LIB[node.op].category === 'DISPLACEMENT_OPS';

    if (isBool) {
      // recurse children
      const childVars = (node.children || []).map(ch => walk(ch, s, pVar));

      // no children: return large distance or empty SdResult
      if (childVars.length === 0) {
        if (!with_materials) {
          const zeroD = unique('d');
          lines.push(P.varDecl('f32', zeroD, '0.0'));
          return zeroD;
        } else {
          const zeroR = unique('r');
          lines.push(
            P.varDecl(
              'SdResult',
              zeroR,
              `SdResult(1e6, 0.0, ${P.fmtVal([0, 0, 0])}, 1.0, ${P.fmtVal([0, 0, 0, 0])}, 0u)`
            )
          );
          return zeroR;
        }
      }

      // fold children
      if (!with_materials) {
        // distance-only folding
        let acc = childVars[0];
        if (childVars.length === 1) return acc;

        const def = SD_LIB[node.op];
        const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set();
        const extra = Object.keys(def.args)
          .filter(n => !ctx.has(n))
          .map(n => P.fmtVal(node.args[n]));

        // first op
        const firstExpr = P.call(node.op, [childVars[0], childVars[1], ...extra]);
        const dVar = unique('d');
        lines.push(P.varDecl('f32', dVar, firstExpr));

        // subsequent
        for (let i = 2; i < childVars.length; i++) {
          lines.push(
            P.assign(dVar, P.call(node.op, [dVar, childVars[i], ...extra]))
          );
        }
        return dVar;
      } else {
        // material folding
        const [first, ...rest] = childVars;
        let accR = unique('r');
        lines.push(P.varDecl('SdResult', accR, first));
        let accC = unique('c');
        let accID = unique('i');
        lines.push(P.varDecl('vec4', accC, `${accR}.color`));
        lines.push(P.varDecl('u32', accID, `${accR}.shapeID`));

        const def = SD_LIB[node.op];
        const kLit = P.fmtVal(node.args.k != null ? node.args.k : node.args.s || 0.0);

        rest.forEach(childVar => {
          // call the Mat variant
          const callExpr = ['opUnion', 'opSubtract', 'opIntersect'].includes(node.op)
            ? `${node.op}Mat(${accR}, ${childVar})`
            : `${node.op}Mat(${accR}, ${childVar}, ${kLit})`;

          const tmpR = unique('r');
          lines.push(P.varDecl('SdResult', tmpR, callExpr));


          const tmpC = unique('c');
          const tmpID = unique('i');

          switch (node.op) {
            case 'opUnion': {
              const cond = `${accR}.dist < ${childVar}.dist`;
              lines.push(
                P.varDecl('vec4', tmpC,
                  P.ternary(cond,
                    `${childVar}.color`,
                    `${accR}.color`,
                    'vec4'))
              );
              lines.push(
                P.varDecl('u32', tmpID,
                  P.ternary(cond,
                    `${childVar}.shapeID`,
                    `${accR}.shapeID`,
                    'u32'))
              );
              break;
            }

            case 'opSubtract': {
              // always keep the “a” branch
              lines.push(P.varDecl('vec4', tmpC, `${accR}.color`));
              lines.push(P.varDecl('u32', tmpID, `${accR}.shapeID`));
              break;
            }

            case 'opIntersect': {
              const cond = `${accR}.dist < ${childVar}.dist`;
              lines.push(
                P.varDecl('vec4', tmpC,
                  P.ternary(cond,
                    `${accR}.color`,
                    `${childVar}.color`,
                    'vec4'))
              );
              lines.push(
                P.varDecl('u32', tmpID,
                  P.ternary(cond,
                    `${accR}.shapeID`,
                    `${childVar}.shapeID`,
                    'u32'))
              );
              break;
            }

            case 'opChamferUnion':
            case 'opChamferSubtract':
            case 'opChamferIntersect': {
              const baseCond = `${accR}.dist < ${childVar}.dist`;
              let chamCond;
              if (node.op === 'opChamferUnion') {
                chamCond = `min(${accR}.dist, ${childVar}.dist) < (` +
                  `${accR}.dist - ${kLit} + ${childVar}.dist) * 0.5`;
              } else if (node.op === 'opChamferSubtract') {
                chamCond = `min(${accR}.dist, ${childVar}.dist) < (` +
                  `${accR}.dist + ${kLit} - ${childVar}.dist) * 0.5`;
              } else {
                chamCond = `min(${accR}.dist, ${childVar}.dist) < (` +
                  `${accR}.dist + ${kLit} + ${childVar}.dist) * 0.5`;
              }

              // first fold base vs child
              const baseColor = P.ternary(baseCond,
                `${childVar}.color`,
                `${accR}.color`,
                'vec4');
              const baseID = P.ternary(baseCond,
                `${childVar}.shapeID`,
                `${accR}.shapeID`,
                'u32');

              // then fold chamfer vs that
              lines.push(
                P.varDecl('vec4', tmpC,
                  P.ternary(chamCond,
                    baseColor,
                    baseColor,
                    'vec4'))
              );
              lines.push(
                P.varDecl('u32', tmpID,
                  P.ternary(chamCond,
                    baseID,
                    baseID,
                    'u32'))
              );
              break;
            }

            case 'opSmoothUnion': {
              lines.push(
                P.varDecl('vec4', tmpC,
                  `mix(${accC}, ${childVar}.color, ${tmpR}.blend)`)
              );
              const cond = `${accR}.dist < ${childVar}.dist`;
              lines.push(
                P.varDecl('u32', tmpID,
                  P.ternary(cond,
                    `${childVar}.shapeID`,
                    `${accR}.shapeID`,
                    'u32'))
              );
              break;
            }

            case 'opSmoothSubtract':
            case 'opSmoothIntersect': {
              lines.push(
                P.varDecl('vec4', tmpC,
                  `mix(${accR}.color, ${childVar}.color, ${tmpR}.blend)`)
              );
              const cond = `${accR}.dist < ${childVar}.dist`;
              lines.push(
                P.varDecl('u32', tmpID,
                  P.ternary(cond,
                    `${accR}.shapeID`,
                    `${childVar}.shapeID`,
                    'u32'))
              );
              break;
            }

            default:
              throw new Error(`Unsupported CSG op: ${node.op}`);
          }

          // write merged result back into accR, accC, accID…
          lines.push(
            P.assign(
              accR, 
              `SdResult(${tmpR}.dist, 0.0, ${P.fmtVal([0,0,0])}, 1.0, ${tmpC}, ${tmpID})`
            )
          );
          lines.push(P.assign(accC, tmpC));
          lines.push(P.assign(accID, tmpID));
        });
        return accR;
      }
    }

    throw new Error(`Unsupported op: ${node.op}`);
  }

  // 5) Emit the main sdScene function
  if (lang === "wgsl") lines.push(with_materials
    ? `fn sdScene(p: vec3f) -> SdResult {`
    : `fn sdScene(p: vec3f) -> f32 {`
  );

  if (lang === "glsl") lines.push(with_materials
    ? `SdResult sdScene(vec3 p) {`
    : `float sdScene(vec3 p) {`
  );

  const rootVar = walk(scene, 1.0, 'p');
  lines.push(P.ret(rootVar));
  lines.push('}');

  return lines.join('\n');
}
