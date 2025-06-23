// sd-SD_LIB.js must export default `SD_LIB` and named `CONTEXTUAL_ARGUMENTS` as you described:

import SD_LIB, { CONTEXTUAL_ARGUMENTS } from './sd-lib.js'
export function emitFunction(fnDef, lang = 'wgsl') {
  const F = lang === 'glsl' ? fnDef.GLSL : fnDef
  const args =
    lang === 'glsl'
      ? Object.entries(F.args).map(([n, t]) => `${t} ${n}`).join(', ')
      : Object.entries(F.args).map(([n, t]) => `${n}: ${t}`).join(', ')
  if (lang === 'glsl') {
    return `${F.returns} ${F.fn_name}(${args}) {\n  ${F.body.replace(/\n/g, '\n  ')}\n}`
  } else {
    return `fn ${F.fn_name}(${args}) -> ${F.returns} {\n  ${F.body.replace(/\n/g, '\n  ')}\n}`
  }
}

export function compileScene(
  scene,
  lang = 'wgsl',
  include_referenced_fn_defs = true,
  with_materials = true    // ← now true by default
) {
  // —————————————————————————————————————————————
  // 1) Printers: WGSL and GLSL
  // —————————————————————————————————————————————
  const printers = {
    wgsl: {
      header: (() => {
        let h = `// Auto-generated scene (with materials)

struct SdResult {
  dist:    f32,
  blend:   f32,
  normal:  vec3<f32>,
  ao:      f32,
  color:   vec4<f32>,
  shapeID: u32,
};

`
        if (with_materials) {
          h += `fn selectSdResult(a: SdResult, b: SdResult, cond: bool) -> SdResult {
  if (cond){ return b;} else {return a;}
}

fn opUnionMat(a: SdResult, b: SdResult) -> SdResult {
  var out = selectSdResult(a, b, a.dist < b.dist);
  out.blend = a.dist < b.dist ? 0.0 : 1.0;
  return out;
}

fn opSubtractMat(a: SdResult, b: SdResult) -> SdResult {
  var out = a;
  out.dist = max(a.dist, -b.dist);
  out.blend = 0.0;
  return out;
}

fn opSmoothUnionMat(a: SdResult, b: SdResult, k: f32) -> SdResult {
  let h = clamp(0.5 + 0.5 * (b.dist - a.dist) / k, 0.0, 1.0);
  let dist = mix(b.dist, a.dist, h) - k * h * (1.0 - h);
  return SdResult(dist, h, vec3<f32>(0), 1.0, vec4<f32>(0), 0u);
}

fn opSmoothSubtractMat(a: SdResult, b: SdResult, k: f32) -> SdResult {
  let h = clamp(0.5 - 0.5 * (a.dist + b.dist) / k, 0.0, 1.0);
  let dist = mix(a.dist, -b.dist, h) + k * h * (1.0 - h);
  return SdResult(dist, h, vec3<f32>(0), 1.0, vec4<f32>(0), 0u);
}

`
        }
        return h
      })(),
      funcStart: () =>
        with_materials
          ? `fn sdScene(p: vec3<f32>) -> SdResult {`
          : `fn sdScene(p: vec3<f32>) -> f32 {`,
      varDecl: (type, name, expr) => {
        switch (type) {
          case 'vec3':
            return `  var ${name}: vec3<f32> = ${expr};`
          case 'vec4':
            return `  var ${name}: vec4<f32> = ${expr};`
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
      fmtVal: (v) => {
        if (typeof v === 'number') {
          let s = v.toFixed(6)
          if (!s.includes('.')) s += '.0'
          return s
        }
        if (Array.isArray(v) && v.length === 3)
          return `vec3<f32>(${v.map((x) => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 16)
          return `mat4x4<f32>(${v.map((x) => x.toFixed(6)).join(', ')})`
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

`
        if (with_materials) {
          h += `SdResult selectSdResult(SdResult a, SdResult b, bool cond) {
  if (cond){ return b;} else {return a;}
}

SdResult opUnionMat(SdResult a, SdResult b) {
  SdResult out = selectSdResult(a, b, a.dist < b.dist);
  out.blend = a.dist < b.dist ? 0.0 : 1.0;
  return out;
}

SdResult opSubtractMat(SdResult a, SdResult b) {
  SdResult out = a;
  out.dist  = max(a.dist, -b.dist);
  out.blend = 0.0;
  return out;
}

SdResult opSmoothUnionMat(SdResult a, SdResult b, float k) {
  float h = clamp(0.5 + 0.5 * (b.dist - a.dist) / k, 0.0, 1.0);
  float dist = mix(b.dist, a.dist, h) - k * h * (1.0 - h);
  return SdResult(dist, h, vec3(0), 1.0, vec4(0), 0u);
}

SdResult opSmoothSubtractMat(SdResult a, SdResult b, float k) {
  float h = clamp(0.5 - 0.5 * (a.dist + b.dist) / k, 0.0, 1.0);
  float dist = mix(a.dist, -b.dist, h) + k * h * (1.0 - h);
  return SdResult(dist, h, vec3(0), 1.0, vec4(0), 0u);
}

`
        }
        return h
      })(),
      funcStart: () =>
        with_materials
          ? `SdResult sdScene(vec3 p) {`
          : `float sdScene(vec3 p) {`,
      varDecl: (type, name, expr) => {
        if (type === 'vec3') return `  vec3  ${name} = ${expr};`
        if (type === 'f32') return `  float ${name} = ${expr};`
        if (type === 'SdResult') return `  SdResult ${name} = ${expr};`
        throw new Error(`Unknown varDecl type: ${type}`)
      },
      assign: (name, expr) => `  ${name} = ${expr};`,
      ret: (name) => `  return ${name};`,
      fmtVal: (v) => {
        if (typeof v === 'number') {
          let s = v.toFixed(6)
          if (!s.includes('.')) s += '.0'
          return s
        }
        if (Array.isArray(v) && v.length === 3)
          return `vec3(${v.map((x) => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 16)
          return `mat4(${v.map((x) => x.toFixed(6)).join(', ')})`
        throw new Error(`GLSL fmtVal can't handle ${JSON.stringify(v)}`)
      },
      call: (op, args) => `${op}(${args.join(', ')})`,
    },
  }

  const P = printers[lang] || printers.wgsl
  const BOOL_OPS = new Set([
    'opUnion','opSubtract','opIntersect',
    'opChamferUnion','opChamferSubtract','opChamferIntersect',
    'opSmoothUnion','opSmoothSubtract','opSmoothIntersect',
  ])

  let idCounter = 0
  const lines = []

  function unique(prefix) {
    return `${prefix}_${idCounter++}`
  }

  // 2) Gather which SD_LIB functions are needed
  const functions_referenced = new Set()
  function collect(node) {
    functions_referenced.add(node.op)
    ;(node.modifiers||[]).forEach(m=>functions_referenced.add(m.op))
    ;(node.children||[]).forEach(collect)
  }
  collect(scene)

  // 3) Emit referenced helper functions if requested
  if (include_referenced_fn_defs) {
    for (let op of functions_referenced) {
      lines.push(emitFunction(SD_LIB[op], lang))
      lines.push('')
    }
  }

  // 4) Emit header (SdResult + mat-ops)
  lines.push(P.header)

  // 5) Recursive walkers

  // 5a) distance-only
  function walkDistance(node, scale, inVar) {
    functions_referenced.add(node.op)
    const pVar = unique('p')
    const dVar = unique('d')
    lines.push(P.varDecl('vec3', pVar, inVar))

    // modifiers
    let s = scale
    for (let mod of node.modifiers||[]) {
      functions_referenced.add(mod.op)
      const def = SD_LIB[mod.op]
      const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set()
      const args = [pVar]
      for (let name of Object.keys(def.args)) {
        if (!ctx.has(name)) args.push(P.fmtVal(mod.args[name]))
      }
      lines.push(P.assign(pVar, P.call(mod.op, args)))
      if (mod.op==='opScale') s *= mod.args.s
      else if (mod.op==='opTransform') {
        const inv = mod.args.transform[0]
        s *= 1/inv
      }
    }

    // primitive?
    if (node.op in SD_LIB.DISTANCE_FUNCTIONS) {
      const def = SD_LIB[node.op]
      const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set()
      const args = [pVar]
      for (let name of Object.keys(def.args)) {
        if (!ctx.has(name)) args.push(P.fmtVal(node.args[name]))
      }
      lines.push(P.varDecl('f32', dVar, P.call(node.op, args)))
      if (s!==1.0) lines.push(P.assign(dVar, `${dVar} * ${s.toFixed(6)}`))
      return dVar
    }

    // boolean/displacement
    const fnCat = SD_LIB[node.op].category
    if (BOOL_OPS.has(node.op) || fnCat==='DISPLACEMENT_OPS') {
      const childDs = (node.children||[]).map(ch=>walkDistance(ch, s, pVar))
      if (childDs.length===0) {
        lines.push(P.varDecl('f32', dVar, '0.0'))
        return dVar
      }
      if (childDs.length===1) {
        lines.push(P.varDecl('f32', dVar, childDs[0]))
        return dVar
      }
      const def = SD_LIB[node.op]
      const ctx = CONTEXTUAL_ARGUMENTS[def.category] || new Set()
      const extra = Object.keys(def.args)
        .filter(n=>!ctx.has(n))
        .map(n=>P.fmtVal(node.args[n]))

      // fold
      let expr = P.call(node.op, [childDs[0], childDs[1], ...extra])
      lines.push(P.varDecl('f32', dVar, expr))
      for (let i=2; i<childDs.length; i++) {
        expr = P.call(node.op, [dVar, childDs[i], ...extra])
        lines.push(P.assign(dVar, expr))
      }
      return dVar
    }

    throw new Error(`Unsupported op: ${node.op}`)
  }

  function walkMaterial(node, scale, inVar) {
    const pVar = unique('p')
    lines.push(P.varDecl('vec3', pVar, inVar))

    // 1) apply modifiers, track uniform scale s
    let s = scale
    for (let mod of node.modifiers||[]) {
      const def = SD_LIB[mod.op]
      const ctx = CONTEXTUAL_ARGUMENTS[def.category]||new Set()
      const args = [pVar]
      for (let name of Object.keys(def.args)) {
        if (!ctx.has(name)) args.push(P.fmtVal(mod.args[name]))
      }
      lines.push(P.assign(pVar, P.call(mod.op, args)))
      if (mod.op==='opScale') s *= mod.args.s
      else if (mod.op==='opTransform') { const inv=mod.args.transform[0]; s*=1/inv }
    }

    // 2) leaf?
    if (node.op in SD_LIB.DISTANCE_FUNCTIONS) {
      // compute local‐space distance
      const def = SD_LIB[node.op]
      const ctx = CONTEXTUAL_ARGUMENTS[def.category]||new Set()
      const dVar = unique('d')
      const args = [pVar]
      for (let n of Object.keys(def.args))
        if (!ctx.has(n)) args.push(P.fmtVal(node.args[n]))
      lines.push(P.varDecl('f32', dVar, P.call(node.op,args)))
      if (s!==1.0) lines.push(P.assign(dVar, `${dVar} * ${s.toFixed(6)}`))

      // package into an SdResult
      const rVar = unique('r')
      const m = node.material||{r:0,g:0,b:0,a:1}
      const col = `vec4<f32>(${m.r.toFixed(6)},${m.g.toFixed(6)},${m.b.toFixed(6)},${m.a.toFixed(6)})`
      const id  = node.id!=null? node.id+'u':'0u'
      lines.push(
        P.varDecl(
          'SdResult',
          rVar,
          `SdResult(${dVar}, 0.0, vec3<f32>(0), 1.0, ${col}, ${id})`
        )
      )
      return rVar
    }

    // 3) CSG/blends
    const children = node.children||[]
    if (children.length===0) {
      const zero = unique('r')
      lines.push(
        P.varDecl('SdResult', zero, `SdResult(1e6,0.0,vec3<f32>(0),1.0,vec4<f32>(0),0u)`)
      )
      return zero
    }

    // 3a) generate code for each child
    const childRs = children.map(ch=>walkMaterial(ch, s, pVar))

    // 3b) initialize accumulator
    let accR = unique('r')
    lines.push(P.varDecl('SdResult', accR, childRs[0]))

    // also extract the child color/id into temporaries
    let accC = unique('c')
    lines.push(P.varDecl(
      'vec4',
      accC,
      `${accR}.color`
    ))
    let accID = unique('i')
    lines.push(P.varDecl(
      'u32',
      accID,
      `${accR}.shapeID`
    ))

    // 3c) fold the rest
    const def = SD_LIB[node.op]
    const ctx = CONTEXTUAL_ARGUMENTS[def.category]||new Set()
    const kLit = P.fmtVal(node.args.k || node.args.s || 0.0)
    for (let i = 1; i < childRs.length; i++) {
      const child = childRs[i]

      // call the mat‐op which returns dist+blend in .blend
      const tmpR = unique('r')
      const opName = node.op === 'opSmoothSubtract'
        ? 'opSmoothSubtractMat'
        : `${ node.op }Mat`
      lines.push(P.varDecl(
        'SdResult',
        tmpR,
        `${opName}(${accR}, ${child}, ${kLit})`
      ))

      // blend the colors
      const tmpC = unique('c')
      lines.push(P.varDecl(
        'vec4',
        tmpC,
        `mix(${accC}, ${tmpR}.color, ${tmpR}.blend)`
      ))

      // pick shapeID by blend > 0.5
      const tmpID = unique('i')
      lines.push(P.varDecl(
        'u32',
        tmpID,
        `select(${accID}, ${child}.shapeID, ${tmpR}.blend > 0.5)`
      ))

      // write them back into accR (with new distance)
      lines.push(P.assign(
        accR,
        `SdResult(${tmpR}.dist, 0.0, vec3<f32>(0), 1.0, ${tmpC}, ${tmpID})`
      ))

      // update color/id vars for next iteration
      lines.push(P.assign(accC, tmpC))
      lines.push(P.assign(accID, tmpID))
    }

    return accR
  }

  // 4) emit main
  lines.push(P.funcStart())
  const root = with_materials
    ? walkMaterial(scene, 1.0, 'p')
    : walkDistance(scene, 1.0, 'p')
  lines.push(P.ret(root))
  lines.push('}')

  return lines.join('\n')
}