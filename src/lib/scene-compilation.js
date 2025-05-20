// sd-SD_LIB.js must export default `SD_LIB` and named `CONTEXTUAL_ARGUMENTS` as you described:
import SD_LIB, { CONTEXTUAL_ARGUMENTS } from './sd-lib.js'

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

export function compileScene(scene, lang = 'wgsl', include_referenced_fn_defs) {
  // 1) Printer definitions
  const functions_referenced_in_scene = new Set([])
  const printers = {
    wgsl: {
      // header: fn sdScene(p: vec3<f32>) -> f32 {
      funcStart: () => `fn sdScene(p: vec3<f32>) -> f32 {`,
      // varDecl('vec3', 'p0', 'p') → "  var p0: vec3<f32> = p;"
      varDecl: (type, name, expr) => {
        const t =
          type === 'vec3'
            ? `var ${name}: vec3<f32> = ${expr};`
            : `var ${name}: f32       = ${expr};`
        return `  ${t}`
      },
      assign: (name, expr) => `  ${name} = ${expr};`,
      ret: (name) => `  return ${name};`,
      // fmt a JS number or array into WGSL literal
      fmtVal: (v) => {
        if (typeof v === 'number') return v.toFixed(6)
        if (Array.isArray(v) && v.length === 3)
          return `vec3<f32>(${v.map((x) => x.toFixed(6)).join(', ')})`
        if (Array.isArray(v) && v.length === 16)
          return `mat4x4<f32>(${v.map((x) => x.toFixed(6)).join(', ')})`
        throw new Error(`WGSL fmtVal can't handle ${JSON.stringify(v)}`)
      },
      call: (op, args) => `${op}(${args.join(', ')})`,
    },

    glsl: {
      funcStart: () => `float sdScene(vec3 p) {`,
      varDecl: (type, name, expr) => {
        const t = type === 'vec3' ? `vec3 ${name} = ${expr};` : `float ${name} = ${expr};`
        return `  ${t}`
      },
      assign: (name, expr) => `  ${name} = ${expr};`,
      ret: (name) => `  return ${name};`,
      fmtVal: (v) => {
        if (typeof v === 'number') return v.toFixed(6)
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

  let idCounter = 0
  const lines = []

  function unique(prefix) {
    return `${prefix}_${idCounter++}`
  }

  function collectUsageDetails(node) {
    functions_referenced_in_scene.add(node.op)
    if (node.children) {
      node.children.forEach((child) => collectUsageDetails(child))
    }
    if (node.modifiers) {
      node.modifiers.forEach((modifier) => functions_referenced_in_scene.add(modifier.op))
    }
  }

  /**
   * Recursively generate code for a node.
   * @param {object} node
   * @param {number} scale      accumulated uniform scale
   * @param {string} inVar      name of the vec3 input
   * @returns {string}          name of the float var with this node's distance
   */
  function walk(node, scale, inVar) {
    functions_referenced_in_scene.add(node.op)
    const pVar = unique('p')
    const dVar = unique('d')

    // start from the incoming point
    lines.push(P.varDecl('vec3', pVar, inVar))

    // apply modifiers in order
    for (let mod of node.modifiers || []) {
      functions_referenced_in_scene.add(mod.op)
      const fnDef = SD_LIB[mod.op]
      if (!fnDef) throw new Error(`Unknown modifier ${mod.op}`)
      const argNames = Object.keys(fnDef.args)
      const ctxArgs = CONTEXTUAL_ARGUMENTS[fnDef.category] || new Set()

      // build call args in fn-defined order, skipping contextual ones
      const callArgs = [pVar]
      for (let name of argNames) {
        if (ctxArgs.has(name)) continue
        const val = mod.args[name]
        if (val === undefined) throw new Error(`Missing arg ${name} for ${mod.op}`)
        callArgs.push(P.fmtVal(val))
      }
      lines.push(P.assign(pVar, P.call(mod.op, callArgs)))

      // only these two modify scale
      if (mod.op === 'opScale') {
        scale *= mod.args.s
      } else if (mod.op === 'opTransform') {
        // transform matrix is the inverse: its [0] = 1/s
        const inv = mod.args.transform[0]
        scale *= 1 / inv
      }
    }

    // primitive distance‐function?
    if (node.op in SD_LIB.DISTANCE_FUNCTIONS) {
      const fnDef = SD_LIB[node.op]
      const argNames = Object.keys(fnDef.args)
      const ctxArgs = CONTEXTUAL_ARGUMENTS[fnDef.category] || new Set()
      const callArgs = [pVar]

      for (let name of argNames) {
        if (ctxArgs.has(name)) continue
        callArgs.push(P.fmtVal(node.args[name]))
      }

      lines.push(P.varDecl('float', dVar, P.call(node.op, callArgs)))

      if (scale !== 1.0) {
        lines.push(P.assign(dVar, `${dVar} * ${scale.toFixed(6)}`))
      }
      return dVar
    }

    // boolean, blend or displacement
    const fnCat = SD_LIB[node.op].category
    if (BOOL_OPS.has(node.op) || fnCat === 'DISPLACEMENT_OPS') {
      // generate child distances
      const childDs = (node.children || []).map((ch) => walk(ch, scale, pVar))

      // no children → zero
      if (childDs.length === 0) {
        lines.push(P.varDecl('float', dVar, '0.0'))
        return dVar
      }
      // single-child passthrough
      if (childDs.length === 1) {
        lines.push(P.varDecl('float', dVar, childDs[0]))
        return dVar
      }

      // collect extra (non-contextual) args
      const fnDef = SD_LIB[node.op]
      const argNames = Object.keys(fnDef.args)
      const ctxArgs = CONTEXTUAL_ARGUMENTS[fnDef.category] || new Set()
      const extra = argNames.filter((n) => !ctxArgs.has(n)).map((n) => P.fmtVal(node.args[n]))

      // fold pairwise
      let expr = P.call(node.op, [childDs[0], childDs[1], ...extra])
      lines.push(P.varDecl('float', dVar, expr))

      for (let i = 2; i < childDs.length; i++) {
        expr = P.call(node.op, [dVar, childDs[i], ...extra])
        lines.push(P.assign(dVar, expr))
      }

      return dVar
    }

    throw new Error(`Unsupported op: ${node.op}`)
  }

  collectUsageDetails(scene)
  let fn_defs = [...functions_referenced_in_scene]
    .map((op_name) => emitFunction(SD_LIB[op_name], lang))
    .join('\n\n')
  // emit the function
  lines.push(fn_defs + '\n\n\n')

  lines.push(P.funcStart())
  const rootD = walk(scene, 1.0, 'p')
  lines.push(P.ret(rootD))
  lines.push(`}`)

  return lines.join('\n')
}
