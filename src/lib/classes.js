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
//         }
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

// EXAMPLE SCENE, SERIALIZED JSON REPRESENTATION
//  const SCENE_DEF_JSON = {
//   op: 'opUnion',

//   children: [
//     {
//       op: 'sdSphere',
//       args: { r: 0.3 },
//       // Material: red
//       material: { r: 5.0, g: 1.0, b: 0.0, a: 1.0 },
//       // (Optionally, you could provide an "id" manually; otherwise it is auto-assigned.)
//       modifiers: [{ op: 'opTranslate', args: { t: [2.3, 3, -15.0] } }],
//     },
//     {
//       op: 'opSmoothUnion',
//       args: { k: 0.07 },
//       children: [
//         // Trunk: smooth opUnion of two overlapping spheres.
//         {
//           op: 'opSmoothUnion',
//           args: { k: 0.3 },
//           children: [
//             {
//               op: 'sdRoundBox',
//               args: { b: [3, 0.2, 3], r: 0.5 },
//               // Material: red
//               material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },

//               modifiers: [
//                 // no artifact when scaled down
//                 // { op: 'opTranslate', args: { t: [0.0, -0.5, 0.0] } },
//                 // { op: 'opRotateY', args: { a: 0 } },
//                 // { op: 'opRotateX', args: { a: 0 } },
//                 // { op: 'opRotateZ', args: { a: 0 } },

//                 // { op: 'opScale', args: { s: 0.3 } },
//                 {
//                   // this has artifact when scaled down
//                   op: 'opTransform',
//                   args: {
//                     transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0.5, 0, 1],
//                   },
//                 },
//               ],
//             },
//             {
//               op: 'sdSphere',
//               args: { r: 0.3 },
//               // Material: red
//               material: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
//               // (Optionally, you could provide an "id" manually; otherwise it is auto-assigned.)
//               modifiers: [
//                 { op: 'opTranslate', args: { t: [0.0, 0.3, 0.0] } },
//                 { op: 'opScale', args: { s: 1 } },
//               ],
//             },
//             {
//               op: 'sdSphere',
//               args: { r: 0.3 },
//               // Material: red
//               material: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 },
//               // (Optionally, you could provide an "id" manually; otherwise it is auto-assigned.)
//               modifiers: [
//                 { op: 'opTranslate', args: { t: [-2.0, 0.1, 1.5] } },
//                 { op: 'opScale', args: { s: 1 } },
//               ],
//             },
//             {
//               op: 'sdSphere',
//               args: { r: 0.25 },
//               material: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
//               modifiers: [{ op: 'opTranslate', args: { t: [0.0, 0.7, 0.0] } }],
//             },
//           ],
//         },
//         // Canopy: smooth opUnion of several spheres.
//         {
//           op: 'opSmoothUnion',
//           args: { k: 0.4 },
//           children: [
//             {
//               op: 'sdSphere',
//               args: { r: 0.4 },
//               // Material: green
//               material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
//               modifiers: [{ op: 'opTranslate', args: { t: [0.0, 1.2, 0.0] } }],
//             },
//             {
//               op: 'sdSphere',
//               args: { r: 0.35 },
//               material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
//               modifiers: [{ op: 'opTranslate', args: { t: [0.4, 1.3, 0.0] } }],
//             },
//             {
//               op: 'sdSphere',
//               args: { r: 0.25 },
//               material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
//               modifiers: [{ op: 'opTranslate', args: { t: [-0.4, 1.3, 0.0] } }],
//             },
//             {
//               op: 'sdSphere',
//               args: { r: 0.3 },
//               material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
//               modifiers: [{ op: 'opTranslate', args: { t: [0.0, 1.5, 0.4] } }],
//             },
//           ],
//         },
//       ],
//     },
//   ],
// }

import SD_LIB from './sd-lib'
import { compileScene } from './scene-compilation'
import { Observable } from "@babylonjs/core"

// 1) Flatten SD_LIB into a quick lookup: opName → { category, def }
const OP_DEFS = {}
for (const category in SD_LIB) {
  for (const opName in SD_LIB[category]) {
    OP_DEFS[opName] = { category, def: SD_LIB[category][opName] }
  }
}

// 2) Your contextual-args sets (copied from your init script)
const CONTEXTUAL = {
  DISTANCE_FUNCTIONS: new Set(['p']),
  BOOLEAN_OPS: new Set(['d1', 'd2']),
  DISPLACEMENT_OPS: new Set(['p', 'd1', 'd2']),
  POSITIONING_OPS: new Set(['p']),
  PRIMITIVE_OPS: new Set(['p', 'd']),
}

class SDFLibraryFunctionRepr {
  constructor({ op, args = {}, name = null, id = null }, scene, parent = null) {
    // assign or allocate a unique integer id
    // in the superclass constructor
    if (id != null) {
      this.id = Number(id)
      scene.registerId(this.id, this)
    } else {
      this.id = scene.allocateId(this)
    }
    this.op = op
    this.name = name
    this.scene = scene
    this.parent = parent
    this.onChange = () => { this.scene?.onNeedsRedrawObservable.notifyObservers(true)}
    this.def = SD_LIB?.[op]
    const isEqual = (a, b) => {
      if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) {
        return a.every((v, i) => v === b[i])
      }
      return a === b
    }

    this.args = new Proxy(
      { ...args },
      {
        set: (target, prop, value) => {
          const previous = target[prop]
          if (isEqual(previous, value)) {
            target[prop] = value
            return true
          }
          target[prop] = value
          if (this.onChange) this.onChange(prop, value)
          return true
        },
      },
    )
  }

  patch(path, value) {
    // returns oldValue, serialized if it has a serialize() method
  }
}

/*
 * Defines classes for procedural SDF scene construction:
 *  - SDFModifier: wraps a modifier operation
 *  - SDFNode: wraps an SDF primitive or CSG node, with args, material, modifiers, children, and optional name/id
 *  - SDFScene: hosts the root SDFNode
 *  - generateScene: returns a fully-instantiated SDFScene
 */

// --- SDFModifier stays exactly the same ---
export class SDFModifier extends SDFLibraryFunctionRepr {
  /**
   * @param {{op: string, args: object}} config
   */
  constructor({ op, args = {} }, scene, parent = null) {
    super(...arguments)
  }
}

// --- SDFNode: each node knows its scene & parent, allocates/releases IDs automatically ---
export class SDFNode extends SDFLibraryFunctionRepr {
  /**
   * @param {object} config
   * @param {SDFScene} scene
   * @param {SDFNode|null} parent
   */
  constructor({ material = {}, modifiers = [], children = [] }, scene, parent = null) {
    super(...arguments)
    this.material = material
    // wrap and store modifiers
    this.modifiers = modifiers?.length ? modifiers.map((m) => new SDFModifier(m, scene, this)) : []
    // recursively build children, passing along scene & parent
    this.children = []
    for (const childConfig of children) {
      this.children.push(new SDFNode(childConfig, scene, this))
    }
  }

  /**
   * Add a new modifier op (from SD_LIB) to this node.
   * @param opName   One of the keys in SD_LIB (e.g. "opTranslate", "opScale", etc.)
   * @param args     Optional overrides for that modifier’s arguments
   * @returns        The newly created SDFModifier
   */
  addModifier(opName, args = {}) {
    this.scene.onNeedsRedrawObservable.notifyObservers(true)
    // 1) Build a minimal config for that op (same as addNode does under the hood)
    const cfg = this.scene._makeConfigFromLib(opName)
    // 2) Override any default args with what the caller passed
    cfg.args = { ...cfg.args, ...args }
    // 3) Wrap it in an SDFModifier
    const mod = new SDFModifier(cfg, this.scene, this)
    // 4) Attach to this node and re-sync any adapters
    this.modifiers.push(mod)
    this.scene.updateAdapters()
    return mod
  }

  removeModifier(index) {
    this.scene.onNeedsRedrawObservable.notifyObservers(true)
    this.modifiers.splice(index, 1)
    this.scene.updateAdapters()
  }

  /**
   * Add a new child from a config object, auto-assigning its IDs
   * @returns {SDFNode} the newly created child
   */
  addChild(config) {
    this.scene.onNeedsRedrawObservable.notifyObservers(true)
    const child = new SDFNode(config, this.scene, this)
    this.children.push(child)
    this.scene.updateAdapters()
    return child
  }

  /**
   * Remove a direct child node (or by ID), freeing all IDs in its subtree
   * @param {SDFNode|number} toRemove
   * @returns {boolean} true if removed
   */
  removeChild(toRemove) {
    this.scene.onNeedsRedrawObservable.notifyObservers(true)
    const target =
      typeof toRemove === 'number' ? this.children.find((c) => c.id === toRemove) : toRemove
    if (!target) return false

    // free its entire subtree of IDs
    const recurseFree = (node) => {
      for (const c of node.children) recurseFree(c)
      this.scene.releaseId(node.id)
    }
    recurseFree(target)

    // --- remove child reactively using splice ---
    const idx = this.children.indexOf(target)
    if (idx !== -1) {
      this.children.splice(idx, 1)
    }

    target.parent = null
    return true
  }

  /**
   * Serialize this node into a plain config object.
   * @param {boolean} recursive  if true, also include full subtree
   * @returns {object}
   */
  serialize(recursive = false) {
    const cfg = {
      op: this.op,
      args: { ...this.args },
      material: { ...this.material },
      modifiers: this.modifiers.map((m) => ({
        op: m.op,
        args: { ...m.args },
      })),
      // only emit children if deep-cloning
      children: [],
    }

    if (recursive) {
      cfg.children = this.children.map((c) => c.serialize(true))
    }

    // preserve name if you’d like
    if (this.name != null) {
      cfg.name = this.name
    }

    return cfg
  }

  // public entry for GLSL
  toGLSL() {
    return this._generateShader('glsl')
  }

  // reuse for WGSL as well:
  toWGSL() {
    return this._generateShader('wgsl')
  }

  // inside your SDFNode class…

  /**
   * Emit a flat, inlined WGSL (or GLSL) sdScene function that
   * exactly matches the bytecode semantics.
   */
  _generateShader(lang) {
    return compileScene(this, lang)
  }

  /** Turn a name into a safe WGSL/GLSL identifier. */
  _safeName(name) {
    return name.replace(/\W+/g, '_')
  }

  /** Create a fresh temp name and store definition. */
  _safeTemp(base, expr) {
    return `${base}_${Math.random().toString(36).slice(2, 5)} = ${expr}`
  }

  /** Format a JS value or array into WGSL/GLSL literal. */
  _formatVal(v, type, vec = (n) => `vec${n}<f32>`, mat4 = 'mat4x4<f32>') {
    if (Array.isArray(v)) {
      const ctor = type.startsWith('vec') ? vec(v.length) : mat4
      return `${ctor}(${v.map((x) => x.toFixed(8)).join(', ')})`
    }
    // scalar
    let s = v.toFixed(8)
    if (!s.includes('.')) s += '.0'
    return s
  }

  // inside class SDFNode { …

  _emit(varName, { vec, mat4 }) {
    const { category, def } = OP_DEFS[this.op]
    let expr = varName

    // 1) apply positioning modifiers (translate, rotate, scale, transform)
    for (const mod of this.modifiers) {
      const meta = OP_DEFS[mod.op]
      const args = Object.keys(meta.def.args).filter((a) => !CONTEXTUAL[meta.category].has(a))
      const lits = args.map((a) => {
        if (mod.op === 'opTransform' && a === 'transform') {
          // emit a mat4x4<f32>(…) or mat4(…) literal
          const elems = mod.args[a].map((el) => this._fmtNum(el)).join(', ')
          return `${mat4}(${elems})`
        }
        // fallback for vecN or scalar
        return this._lit(mod.args[a], meta.def.args[a], { vec, mat4 })
      })
      expr = `${mod.op}(${expr}${lits.length ? ', ' + lits.join(', ') : ''})`
    }

    // 2) prepare children & extra args
    const kids = (this.children || []).map((c) => c._emit('p', { vec, mat4 }))
    const extra = Object.keys(def.args)
      .filter((a) => !CONTEXTUAL[category].has(a))
      .map((a) => this._lit(this.args[a], def.args[a], { vec, mat4 }))

    // 3a) leaf‐SDF or primitive: apply local → world scaling
    if (category === 'DISTANCE_FUNCTIONS' || category === 'PRIMITIVE_OPS') {
      // raw local‐space call
      const call = `${this.op}(${[expr, ...extra].join(', ')})`

      // extract uniform scale:
      let sNum = 1.0
      const scaleMod = this.modifiers.find((m) => m.op === 'opScale')
      const xfMod = this.modifiers.find((m) => m.op === 'opTransform')
      if (scaleMod) {
        sNum = scaleMod.args.s
      } else if (xfMod) {
        const M = xfMod.args.transform
        // scale = length of first column (M00,M10,M20)
        sNum = Math.hypot(M[0], M[1], M[2])
      }
      const sLit = this._fmtNum(sNum)

      // world‐space distance
      return `(${call}) * ${sLit}`
    }

    // 3b) boolean/displacement chaining (unchanged)
    if (category === 'BOOLEAN_OPS' || category === 'DISPLACEMENT_OPS') {
      let acc = kids[0]
      const tail = kids.slice(1),
        e = extra.join(', ')
      for (const k of tail) {
        acc = e ? `${this.op}(${acc}, ${k}, ${e})` : `${this.op}(${acc}, ${k})`
      }
      return acc
    }

    throw new Error(`Unsupported category "${category}" for "${this.op}"`)
  }

  _lit(v, type, { vec, mat4 }) {
    // mat4x4 or mat4 literal
    if (Array.isArray(v) && type.startsWith('mat4')) {
      const elems = v.map((el) => this._fmtNum(el)).join(', ')
      return `${mat4}(${elems})`
    }
    // vector literal
    if (Array.isArray(v)) {
      const n = (type.match(/^vec(\d+)/) || [])[1] || v.length
      const elems = v.map((el) => this._fmtNum(el)).join(', ')
      return `${vec(n)}(${elems})`
    }
    // scalar literal
    return this._fmtNum(v)
  }

  /** Always render a number with a decimal point if it doesn’t have one */
  _fmtNum(n) {
    let s = n.toString()
    // if no "." and not scientific (e.g. "1e-3"), append ".0"
    if (!s.includes('.') && !s.toLowerCase().includes('e')) s += '.0'
    return s
  }
}

export class SDFScene {
  /**
   * @param {object} sceneJson  top-level node config
   */
  constructor(sceneJson) {
    if (!sceneJson) {
      throw new Error('SDFScene requires a valid scene JSON')
    }

    // — ID management —
    this.nextId = 1 // next fresh ID
    this.freeIds = [] // recycled IDs
    this.usedIds = new Set() // all currently in-use IDs

    // — Separate lookup tables —
    this.nodeMap = new Map() // id → SDFNode
    this.modifierMap = new Map() // id → SDFModifier

    // — Adapters to notify on changes —
    this.adapters = new Set()

    // Build the actual tree; root will register itself (and its subtree)
    this.root = new SDFNode(sceneJson, this, null)
    this.onNeedsRedrawObservable = new Observable()
    this.selectedNodeId = 0
    this.onNodeSelectedObservable = new Observable()
  }

  // — Adapter API —
  registerAdapter(adapter) {
    this.adapters.add(adapter)
  }
  updateAdapters() {
    for (let a of this.adapters) a.sync()
  }

  // — Internal helpers for ID pooling —
  _reserveId(id, instance) {
    const n = Number(id)
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`Invalid ID: ${id}`)
    }
    if (this.usedIds.has(n)) {
      throw new Error(`Duplicate ID: ${n}`)
    }
    this.usedIds.add(n)
    if (n >= this.nextId) this.nextId = n + 1

    // register in the correct map
    if (instance instanceof SDFModifier) {
      this.modifierMap.set(n, instance)
    } else {
      this.nodeMap.set(n, instance)
    }
  }

  _allocateId(instance) {
    let id
    if (this.freeIds.length) {
      // reuse smallest freed ID
      this.freeIds.sort((a, b) => a - b)
      id = this.freeIds.shift()
    } else {
      id = this.nextId++
    }
    this.usedIds.add(id)

    if (instance instanceof SDFModifier) {
      this.modifierMap.set(id, instance)
    } else {
      this.nodeMap.set(id, instance)
    }
    return id
  }

  _freeId(id) {
    const n = Number(id)
    if (this.usedIds.delete(n)) {
      this.freeIds.push(n)
      this.nodeMap.delete(n)
      this.modifierMap.delete(n)
    }
  }

  // — Public ID API (called from SDFLibraryFunctionRepr) —
  /**
   * Reserve a user-provided ID for a node *or* modifier.
   * @param {number} id
   * @param {SDFLibraryFunctionRepr} instance
   */
  registerId(id, instance) {
    this._reserveId(id, instance)
  }

  /**
   * Allocate the next available ID for a node *or* modifier.
   * @param {SDFLibraryFunctionRepr} instance
   * @returns {number}
   */
  allocateId(instance) {
    return this._allocateId(instance)
  }

  /**
   * Release a previously used ID back into the pool.
   * @param {number} id
   */
  releaseId(id) {
    this._freeId(id)
  }

  // — Lookup by ID —
  /**
   * Find a **node** by its integer ID.
   * @param {number} id
   * @returns {SDFNode|null}
   */
  findNodeById(id) {
    return this.nodeMap.get(Number(id)) || null
  }

  /**
   * Find a **modifier** by its integer ID.
   * @param {number} id
   * @returns {SDFModifier|null}
   */
  findModifierById(id) {
    return this.modifierMap.get(Number(id)) || null
  }

  /**
   * Find *either* a node or modifier by its ID.
   * @param {number} id
   * @returns {SDFLibraryFunctionRepr|null}
   */
  getDescendentById(id) {
    const n = Number(id)
    return this.nodeMap.get(n) ?? this.modifierMap.get(n) ?? null
  }

  // — Tree traversal (nodes only!) —
  traverse(fn) {
    function recurse(node) {
      fn(node)
      for (let c of node.children) recurse(c)
    }
    recurse(this.root)
  }

  // — Legacy API (backwards compatible) —
  /**
   * Remove a node (and subtree) by ID.
   * @param {number} nodeId
   * @returns {boolean}
   */
  removeNodeById(nodeId) {
    const node = this.findNodeById(nodeId)
    if (!node) throw new Error(`Node ${nodeId} not found`)
    if (!node.parent) throw new Error(`Cannot remove the root node`)
    const removed = node.parent.removeChild(node)
    if (removed) {
      // free IDs in the subtree (nodes + modifiers)
      const recurse = (n) => {
        for (let c of n.children) recurse(c)
        for (let m of n.modifiers) this.releaseId(m.id)
        this.releaseId(n.id)
      }
      recurse(node)
    }
    return removed
  }

  /**
   * Create a new node from SD_LIB under `parentOrId`.
   * @param {SDFNode|number} parentOrId
   * @param {string} opName
   * @returns {SDFNode}
   */
  addNode(parentOrId, opName) {
    const parent = typeof parentOrId === 'number' ? this.findNodeById(parentOrId) : parentOrId
    if (!parent) throw new Error(`Parent node ${parentOrId} not found`)
    const cfg = this._makeConfigFromLib(opName)
    return parent.addChild(cfg)
  }

  /**
   * Duplicate a node (by instance or ID).
   * @param {SDFNode|number} nodeOrId
   * @param {boolean} recursive
   * @returns {SDFNode}
   */
  duplicateNode(nodeOrId, recursive = false) {
    const node = typeof nodeOrId === 'number' ? this.findNodeById(nodeOrId) : nodeOrId
    if (!node) throw new Error(`Node ${nodeOrId} not found`)
    if (!node.parent) throw new Error(`Cannot duplicate the root node`)
    const cfg = node.serialize(recursive)
    return node.parent.addChild(cfg)
  }

  // ——————————————————————————————————————————————————————————————
  // Helpers for building from SD_LIB
  // ——————————————————————————————————————————————————————————————

  /** Build a minimal config from the SD_LIB entry for `opName`. */
  _makeConfigFromLib(opName) {
    let def = null
    for (const cat of Object.values(SD_LIB)) {
      if (cat[opName]) {
        def = cat[opName]
        break
      }
    }
    if (!def) {
      throw new Error(`Unknown SD_LIB op "${opName}"`)
    }
    return def.getInstance()
  }

  /** Default value for a given SD_LIB type (e.g. 'f32' or 'vec3f'). */
  _defaultValueForType(type) {
    if (type === 'f32') return 0
    const m = type.match(/^vec(\d+)f$/)
    if (m) {
      return Array(parseInt(m[1], 10)).fill(0)
    }
    return null
  }
}
