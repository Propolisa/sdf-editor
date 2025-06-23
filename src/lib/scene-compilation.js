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
    return `${F.returns} ${fnDef.fn_name}(${args}) {\n  ${F.body.replace(
      /\n/g,
      '\n  '
    )}\n}`
  } else {
    return `fn ${F.fn_name}(${args}) -> ${F.returns} {\n  ${F.body.replace(
      /\n/g,
      '\n  '
    )}\n}`
  }
}

/**
 * Compile a scene-graph into a single sdScene() function in GLSL or WGSL.
 */
export function compileScene(
  scene,
  lang = 'wgsl',
  {include_referenced_fn_defs = true,
  with_materials = false} = {}
) {
  // Which ops produce float-only results?
  const BOOL_OPS = new Set([
    'opUnion',
    'opSubtract',
    'opIntersect',
    'opChamferUnion',
    'opChamferSubtract',
    'opChamferIntersect',
    'opSmoothUnion',
    'opSmoothSubtract',
    'opSmoothIntersect',
  ])

  const wgslTernary = (cond, thenExpr, elseExpr, typeName) => {
    if (typeName === 'SdResult') {
      return `selectSdResult(${elseExpr}, ${thenExpr}, ${cond})`
    } else {
      return `select(${elseExpr}, ${thenExpr}, ${cond})`
    }
  }
  const glslTernary = (cond, thenExpr, elseExpr, typeName) => {
    if (typeName === 'SdResult') {
      return `selectSdResult(${thenExpr}, ${elseExpr}, ${cond})`
    } else {
      return `(${cond} ? ${elseExpr} : ${thenExpr})`
    }
  }

  // Printer definitions for WGSL + GLSL
  const printers = {
    wgsl: {
      header: `// Auto-generated scene (with materials)

struct SdResult {
  dist:    f32,
  blend:   f32,
  normal:  vec3f,
  ao:      f32,
  color:   vec4f,
  shapeID: u32,
};

// Select between two SdResult values
fn selectSdResult(a: SdResult, b: SdResult, cond: bool) -> SdResult {
  if (cond) { return a; } else { return b; }
}

// UNION: pick the nearer
fn opUnionMat(a: SdResult, b: SdResult) -> SdResult {
  let closer = a.dist < b.dist;
  var result: SdResult = selectSdResult(a, b, closer);
  result.blend = select(0.0, 1.0, closer);
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
  result.blend = select(0.0, 1.0, farther);
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
  var result: SdResult = selectSdResult(base, chamRes, chamWin);
  result.blend        = select(0.0, 1.0, chamWin);
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
  var result: SdResult = selectSdResult(base, chamRes, chamWin);
  result.blend        = select(0.0, 1.0, chamWin);
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
  var result: SdResult = selectSdResult(base, chamRes, chamWin);
  result.blend        = select(0.0, 1.0, chamWin);
  return result;
}

// SMOOTH-UNION
fn opSmoothUnionMat(a: SdResult, b: SdResult, k: f32) -> SdResult {
  let h = clamp(0.5 + 0.5 * (a.dist - b.dist) / k, 0.0, 1.0);
  let dist    = mix(a.dist, b.dist, h) - k * h * (1.0 - h);
  let color   = mix(a.color, b.color, h);
  let shapeID = select(a.shapeID, b.shapeID, a.dist >= b.dist);
  return SdResult(dist, h, vec3f(0.0), 1.0, color, shapeID);
}

// SMOOTH-SUBTRACT
fn opSmoothSubtractMat(a: SdResult, b: SdResult, k: f32) -> SdResult {
  let h = clamp(0.5 - 0.5 * (a.dist + b.dist) / k, 0.0, 1.0);
  let dist    = mix(a.dist, -b.dist, h) + k * h * (1.0 - h);
  let color   = mix(a.color, b.color, h);
  let shapeID = select(a.shapeID, b.shapeID, a.dist <= -b.dist);
  return SdResult(dist, h, vec3f(0.0), 1.0, color, shapeID);
}

// SMOOTH-INTERSECT
fn opSmoothIntersectMat(a: SdResult, b: SdResult, k: f32) -> SdResult {
  let h = clamp(0.5 - 0.5 * (b.dist - a.dist) / k, 0.0, 1.0);
  let dist    = mix(b.dist, a.dist, h) + k * h * (1.0 - h);
  let color   = mix(a.color, b.color, h);
  let shapeID = select(a.shapeID, b.shapeID, b.dist >= a.dist);
  return SdResult(dist, h, vec3f(0.0), 1.0, color, shapeID);
}
`,

      funcStart: () =>
        with_materials
          ? `fn sdScene(p: vec3f) -> SdResult {`
          : `fn sdScene(p: vec3f) -> f32 {`,
      varDecl: (type, name, expr) => {
        switch (type) {
          case 'vec3':
            return `  var ${name}: vec3f = ${expr};`
          case 'vec4':
            return `  var ${name}: vec4f = ${expr};`
          case 'f32':
            return `  var ${name}: f32       = ${expr};`
          case 'u32':
            return `  var ${name}: u32       = ${expr};`
          case 'SdResult':
            return `  var ${name}: SdResult  = ${expr};`
          default:
            throw new Error(`Unknown varDecl type: ${type}`)
        }
      },
      assign: (name, expr) => `  ${name} = ${expr};`,
      ret: (name) => `  return ${name};`,
      ternary: wgslTernary,
      fmtVal: (v) => {
        if (typeof v === 'number') {
          let s = v.toFixed(6)
          if (!s.includes('.')) s += '.0'
          return s
        }
        if (Array.isArray(v) && v.length === 3)
          return `vec3f(${v.map((x) => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 4)
          return `vec4f(${v.map((x) => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 16)
          return `mat4x4f(${v.map((x) => x.toFixed(6)).join(', ')})`
        throw new Error(`WGSL fmtVal can't handle ${JSON.stringify(v)}`)
      },
      call: (op, args) => `${op}(${args.join(', ')})`,
    },

    glsl: {
      // === FULL GLSL HEADER, UPDATED EXACTLY LIKE WGSL ===
      header: `// Auto-generated scene (with materials)

struct SdResult {
  float dist;
  float blend;
  vec3  normal;
  float ao;
  vec4  color;
  uint  shapeID;
};

// Select between two SdResult values
SdResult selectSdResult(SdResult a, SdResult b, bool cond) {
  if (cond) { return a; } else { return b; }
}

// UNION
SdResult opUnionMat(SdResult a, SdResult b) {
  bool closer = a.dist < b.dist;
  SdResult result = selectSdResult(a, b, closer);
  result.blend = closer ? 1.0 : 0.0;
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
  result.blend = farther ? 1.0 : 0.0;
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
  SdResult result = chamWin ? chamRes : base;
  result.blend    = chamWin ? 1.0 : 0.0;
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
  SdResult result = chamWin ? chamRes : base;
  result.blend    = chamWin ? 1.0 : 0.0;
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
  SdResult result = chamWin ? chamRes : base;
  result.blend    = chamWin ? 1.0 : 0.0;
  return result;
}

// SMOOTH-UNION
SdResult opSmoothUnionMat(SdResult a, SdResult b, float k) {
  float h      = clamp(0.5 + 0.5 * (a.dist - b.dist) / k, 0.0, 1.0);
  float dist   = mix(a.dist, b.dist, h) - k * h * (1.0 - h);
  vec4  color  = mix(a.color, b.color, h);
  uint  shapeID = a.dist >= b.dist ? a.shapeID : b.shapeID;
  return SdResult(dist, h, vec3(0.0), 1.0, color, shapeID);
}

// SMOOTH-SUBTRACT
SdResult opSmoothSubtractMat(SdResult a, SdResult b, float k) {
  float h      = clamp(0.5 - 0.5 * (a.dist + b.dist) / k, 0.0, 1.0);
  float dist   = mix(a.dist, -b.dist, h) + k * h * (1.0 - h);
  vec4  color  = mix(a.color, b.color, h);
  uint  shapeID = a.dist <= -b.dist ? a.shapeID : b.shapeID;
  return SdResult(dist, h, vec3(0.0), 1.0, color, shapeID);
}

// SMOOTH-INTERSECT
SdResult opSmoothIntersectMat(SdResult a, SdResult b, float k) {
  float h      = clamp(0.5 - 0.5 * (b.dist - a.dist) / k, 0.0, 1.0);
  float dist   = mix(b.dist, a.dist, h) + k * h * (1.0 - h);
  vec4  color  = mix(a.color, b.color, h);
  uint  shapeID = b.dist >= a.dist ? b.shapeID : a.shapeID;
  return SdResult(dist, h, vec3(0.0), 1.0, color, shapeID);
}
`,
      funcStart: () =>
        with_materials
          ? `SdResult sdScene(vec3 p) {`
          : `float sdScene(vec3 p) {`,
      varDecl: (type, name, expr) => {
        switch (type) {
          case 'vec3':
            return `  vec3  ${name} = ${expr};`
          case 'vec4':
            return `  vec4  ${name} = ${expr};`
          case 'f32':
          case 'float':
            return `  float ${name} = ${expr};`
          case 'u32':
          case 'uint':
            return `  uint  ${name} = ${expr};`
          case 'SdResult':
            return `  SdResult ${name} = ${expr};`
          default:
            throw new Error(`Unknown varDecl type: ${type}`)
        }
      },
      assign: (name, expr) => `  ${name} = ${expr};`,
      ret: (name) => `  return ${name};`,
      ternary: glslTernary,
      fmtVal: (v) => {
        if (typeof v === 'number') {
          let s = v.toFixed(6)
          if (!s.includes('.')) s += '.0'
          return s
        }
        if (Array.isArray(v) && v.length === 3)
          return `vec3(${v.map((x) => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 4)
          return `vec4(${v.map((x) => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 16)
          return `mat4(${v.map((x) => x.toFixed(6)).join(', ')})`
        throw new Error(`GLSL fmtVal can't handle ${JSON.stringify(v)}`)
      },
      call: (op, args) => `${op}(${args.join(', ')})`,
    },
  }

  const P = printers[lang] || printers.wgsl
  let idCounter = 0
  function unique(prefix) {
    return `${prefix}_${idCounter++}`
  }

  // 1) Collect all ops used in the scene
  const functions_referenced = new Set()
  function collect(node) {
    functions_referenced.add(node.op)
    ;(node.modifiers || []).forEach((m) =>
      functions_referenced.add(m.op)
    )
    ;(node.children || []).forEach(collect)
  }
  collect(scene)

  // 2) Emit each referenced helper if desired
  const lines = []
  if (include_referenced_fn_defs) {
    for (let op of functions_referenced) {
      const def = SD_LIB[op]
      if (!def) continue
      lines.push(emitFunction(def, lang), '')
    }
  }

  // 3) Emit the shared header
  lines.push(P.header)

  // 4) Recursive walk
  function walk(node, inVar) {
    lines.push(`  // node ${node.name || node.op}`)
    const scaleBak = unique('scale_bak')
    lines.push(`  let ${scaleBak}: f32 = scale;`)
    const pVar = unique('p')
    lines.push(P.varDecl('vec3', pVar, inVar))

    // ─── Modifiers ───
    for (let mod of node.modifiers || []) {
      const def = SD_LIB[mod.op]
      const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set()

      if (mod.op === 'opTranslate') {
        // inverse-translate
        lines.push(
          P.assign(
            pVar,
            `opTranslate(${pVar}, ${P.fmtVal(mod.args.t)})`
          )
        )
      } else if (mod.op === 'opScale') {
        // inverse-scale
        lines.push(
          P.assign(
            pVar,
            `opScale(${pVar}, ${P.fmtVal(mod.args.s)})`
          )
        )
        lines.push(
          P.assign(
            'scale',
            `scale * ${P.fmtVal(mod.args.s)}`
          )
        )
      } else if (mod.op === 'opTransform') {
        // M is already the inverse world→local matrix
        const M = mod.args.transform
        lines.push(
          P.assign(
            pVar,
            P.call('opTransform', [pVar, P.fmtVal(M)])
          )
        )
        // if uniform, accumulate forward scale = 1/diag(M)
        const inv0 = M[0],
          inv1 = M[5],
          inv2 = M[10]
        const eps = 1e-6
        if (
          Math.abs(inv0 - inv1) < eps &&
          Math.abs(inv0 - inv2) < eps
        ) {
          const sFwd = 1.0 / inv0
          lines.push(
            P.assign(
              'scale',
              `scale * ${sFwd.toFixed(6)}`
            )
          )
        } else {
          console.warn(
            `Non-uniform inverse matrix on node ${node.op}`
          )
        }
      } else {
        // other custom modifiers
        const args = [pVar]
        for (let name of Object.keys(def.args)) {
          if (!ctx.has(name)) args.push(P.fmtVal(mod.args[name]))
        }
        lines.push(P.assign(pVar, P.call(mod.op, args)))
      }
    }

    // ─── Leaf primitives ───
    if (node.op in SD_LIB.DISTANCE_FUNCTIONS) {
      const def = SD_LIB[node.op]
      const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set()
      const args = [pVar]
      for (let name of Object.keys(def.args)) {
        if (!ctx.has(name)) args.push(P.fmtVal(node.args[name]))
      }
      const dVar = unique('d')
      lines.push(P.varDecl('f32', dVar, P.call(node.op, args)))

      if (!with_materials) {
        const dS = unique('d_scaled')
        lines.push(
          P.varDecl('f32', dS, `${dVar} * scale`)
        )
        lines.push(`  scale = ${scaleBak};`)
        return dS
      }

      const rVar = unique('r')
      const m = node.material || { r: 0, g: 0, b: 0, a: 1 }
      const col = P.fmtVal([m.r, m.g, m.b, m.a])
      const id = node.id != null ? `${node.id}u` : '0u'
      lines.push(
        P.varDecl(
          'SdResult',
          rVar,
          `SdResult(${dVar} * scale, 0.0, ${P.fmtVal(
            [0, 0, 0]
          )}, 1.0, ${col}, ${id})`
        )
      )
      lines.push(`  scale = ${scaleBak};`)
      return rVar
    }

    // ─── CSG / boolean / smooth ops ───
    const isBool =
      BOOL_OPS.has(node.op) ||
      SD_LIB[node.op].category === 'DISPLACEMENT_OPS'
    if (isBool) {
      const childRs = (node.children || []).map((c) =>
        walk(c, pVar)
      )
      // no children
      if (childRs.length === 0) {
        if (!with_materials) {
          const zeroD = unique('d')
          lines.push(`  scale = ${scaleBak};`)
          lines.push(P.varDecl('f32', zeroD, '0.0'))
          return zeroD
        } else {
          const zeroR = unique('r')
          lines.push(
            P.varDecl(
              'SdResult',
              zeroR,
              `SdResult(1e6 * scale, 0.0, ${P.fmtVal(
                [0, 0, 0]
              )}, 1.0, ${P.fmtVal(
                [0, 0, 0, 0]
              )}, 0u)`
            )
          )
          lines.push(`  scale = ${scaleBak};`)
          return zeroR
        }
      }

      if (!with_materials) {
        // distance-only fold
        if (childRs.length === 1) {
          lines.push(`  scale = ${scaleBak};`)
          return childRs[0]
        }
        const def = SD_LIB[node.op]
        const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set()
        const extra = Object.keys(def.args)
          .filter((n) => !ctx.has(n))
          .map((n) => P.fmtVal(node.args[n]))
        const firstExpr = P.call(node.op, [
          childRs[0],
          childRs[1],
          ...extra,
        ])
        const dVar = unique('d')
        lines.push(P.varDecl('f32', dVar, firstExpr))
        for (let i = 2; i < childRs.length; i++) {
          lines.push(
            P.assign(
              dVar,
              P.call(node.op, [dVar, childRs[i], ...extra])
            )
          )
        }
        lines.push(`  scale = ${scaleBak};`)
        return dVar
      } else {
        // material folding
        const accR = unique('r')
        lines.push(
          P.varDecl('SdResult', accR, childRs[0])
        )
        for (let i = 1; i < childRs.length; i++) {
          const cR = childRs[i]
          if (
            ['opUnion', 'opSubtract', 'opIntersect'].includes(
              node.op
            )
          ) {
            lines.push(
              P.assign(
                accR,
                `${node.op}Mat(${accR}, ${cR})`
              )
            )
          } else {
            const kLocal =
              node.args.k != null ? node.args.k : 0.0
            const kLit = `${scaleBak} * ${P.fmtVal(
              kLocal
            )}`
            lines.push(
              P.assign(
                accR,
                `${node.op}Mat(${accR}, ${cR}, ${kLit})`
              )
            )
          }
        }
        lines.push(`  scale = ${scaleBak};`)
        return accR
      }
    }

    throw new Error(`Unsupported op: ${node.op}`)
  }

  // 5) Emit main sdScene
  lines.push(
    with_materials
      ? printers[lang].funcStart()
      : printers[lang].funcStart()
  )
  lines.push(`  var scale: f32 = 1.0;`)
  const root = walk(scene, 'p')
  lines.push(`  return ${root};`)
  lines.push('}')

  return lines.join('\n')
}
