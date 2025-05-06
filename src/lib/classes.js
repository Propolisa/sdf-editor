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

import { StandardMaterial, MeshBuilder } from '@babylonjs/core'
import SD_LIB from './sd-lib'

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

const SCENE_DEF_JSON = {
  op: 'opUnion',

  children: [
    {
      op: 'sdSphere',
      args: { r: 0.3 },
      // Material: red
      material: { r: 5.0, g: 1.0, b: 0.0, a: 1.0 },
      // (Optionally, you could provide an "id" manually; otherwise it is auto-assigned.)
      modifiers: [{ op: 'opTranslate', args: { t: [2.3, 3, -15.0] } }],
    },
    {
      op: 'opSmoothUnion',
      args: { k: 0.07 },
      children: [
        // Trunk: smooth opUnion of two overlapping spheres.
        {
          op: 'opSmoothUnion',
          args: { k: 0.3 },
          children: [
            {
              op: 'sdRoundBox',
              args: { b: [3, 0.2, 3], r: 0.5 },
              // Material: red
              material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },

              modifiers: [
                { op: 'opTranslate', args: { t: [0.0, -0.5, 0.0] } },
                { op: 'opRotateY', args: { a: 0 } },
                { op: 'opRotateX', args: { a: 0 } },
                { op: 'opRotateZ', args: { a: 0 } },

                { op: 'opScale', args: { s: 1 } },
              ],
            },
            {
              op: 'sdSphere',
              args: { r: 0.3 },
              // Material: red
              material: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
              // (Optionally, you could provide an "id" manually; otherwise it is auto-assigned.)
              modifiers: [
                { op: 'opTranslate', args: { t: [0.0, 0.3, 0.0] } },
                { op: 'opScale', args: { s: 1 } },
              ],
            },
            {
              op: 'sdSphere',
              args: { r: 0.3 },
              // Material: red
              material: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 },
              // (Optionally, you could provide an "id" manually; otherwise it is auto-assigned.)
              modifiers: [
                { op: 'opTranslate', args: { t: [-2.0, 0.1, 1.5] } },
                { op: 'opScale', args: { s: 1 } },
              ],
            },
            {
              op: 'sdSphere',
              args: { r: 0.25 },
              material: { r: 1.0, g: 0.0, b: 0.0, a: 1.0 },
              modifiers: [{ op: 'opTranslate', args: { t: [0.0, 0.7, 0.0] } }],
            },
          ],
        },
        // Canopy: smooth opUnion of several spheres.
        {
          op: 'opSmoothUnion',
          args: { k: 0.4 },
          children: [
            {
              op: 'sdSphere',
              args: { r: 0.4 },
              // Material: green
              material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
              modifiers: [{ op: 'opTranslate', args: { t: [0.0, 1.2, 0.0] } }],
            },
            {
              op: 'sdSphere',
              args: { r: 0.35 },
              material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
              modifiers: [{ op: 'opTranslate', args: { t: [0.4, 1.3, 0.0] } }],
            },
            {
              op: 'sdSphere',
              args: { r: 0.25 },
              material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
              modifiers: [{ op: 'opTranslate', args: { t: [-0.4, 1.3, 0.0] } }],
            },
            {
              op: 'sdSphere',
              args: { r: 0.3 },
              material: { r: 0.0, g: 1.0, b: 0.0, a: 1.0 },
              modifiers: [{ op: 'opTranslate', args: { t: [0.0, 1.5, 0.4] } }],
            },
          ],
        },
      ],
    },
  ],
}

/*
 * Defines classes for procedural SDF scene construction:
 *  - SDFModifier: wraps a modifier operation
 *  - SDFNode: wraps an SDF primitive or CSG node, with args, material, modifiers, children, and optional name/id
 *  - SDFScene: hosts the root SDFNode
 *  - generateScene: returns a fully-instantiated SDFScene
 */

// --- SDFModifier stays exactly the same ---
export class SDFModifier {
  /**
   * @param {{op: string, args: object}} config
   */
  constructor({ op, args = {} }) {
    this.op = op
    this.onChange = null

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
}

// 3) small map for WGSL vs GLSL
const SHADERS = {
  wgsl: {
    header: body => `fn sdScene(p: vec3f) -> f32 {\n  return ${body};\n}`,
    vec:   n    => `vec${n}f`,
  },
  glsl: {
    header: body => `float sdScene(vec3 p) {\n  return ${body};\n}`,
    vec:   n    => `vec${n}`,
  },
}

// --- SDFNode: each node knows its scene & parent, allocates/releases IDs automatically ---
export class SDFNode {
  /**
   * @param {object} config
   * @param {SDFScene} scene
   * @param {SDFNode|null} parent
   */
  constructor(
    { op, args = {}, material = {}, modifiers = [], children = [], name = null, id = null },
    scene,
    parent = null,
  ) {
    this.scene = scene
    this.parent = parent

    // assign or allocate a unique integer id
    if (id != null) {
      this.id = Number(id)
      scene.registerId(this.id)
    } else {
      this.id = scene.allocateId()
    }

    this.op = op
    this.args = args
    this.material = material
    this.name = name

    // wrap and store modifiers
    this.modifiers = modifiers.map((m) => new SDFModifier(m))

    // recursively build children, passing along scene & parent
    this.children = []
    for (const childConfig of children) {
      this.children.push(new SDFNode(childConfig, scene, this))
    }
  }

  /**
   * Add a new child from a config object, auto-assigning its IDs
   * @returns {SDFNode} the newly created child
   */
  addChild(config) {
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
    const target =
      typeof toRemove === 'number' ? this.children.find((c) => c.id === toRemove) : toRemove
    if (!target) return false

    // free its entire subtree of IDs
    const recurseFree = (node) => {
      for (const c of node.children) recurseFree(c)
      this.scene.releaseId(node.id)
    }
    recurseFree(target)

    // detach
    this.children = this.children.filter((c) => c !== target)
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
    return this._toShader('glsl')
  }

  // reuse for WGSL as well:
  toWGSL() {
    return this._toShader('wgsl')
  }

  _toShader(lang) {
    const s = SHADERS[lang]
    if (!s) throw new Error(`Unknown shader target "${lang}"`)
    const body = this._emit('p', s)
    return s.header(body)
  }

  _emit(varName, { vec }) {
    const { category, def } = OP_DEFS[this.op]
    let expr = varName

    // 1) apply any positioning modifiers
    for (const mod of this.modifiers) {
      const meta = OP_DEFS[mod.op]
      const args = Object.keys(meta.def.args)
                        .filter(a => !CONTEXTUAL[meta.category].has(a))
      const lits = args.map(a => this._lit(mod.args[a], meta.def.args[a], vec))
      expr = `${mod.op}(${expr}${lits.length ? ', '+lits.join(', ') : ''})`
    }

    // 2) prepare children & extra args
    const kids = (this.children||[]).map(c => c._emit('p', {vec}))
    const extra = Object.keys(def.args)
                        .filter(a => !CONTEXTUAL[category].has(a))
                        .map(a => this._lit(this.args[a], def.args[a], vec))

    // 3a) distance & primitive:  op(expr, …extra)
    if (category === 'DISTANCE_FUNCTIONS' || category === 'PRIMITIVE_OPS') {
      return `${this.op}(${[expr, ...extra].join(', ')})`
    }

    // 3b) binary fold for boolean/displacement
    if (category === 'BOOLEAN_OPS' || category === 'DISPLACEMENT_OPS') {
      let acc = kids[0]
      const tail = kids.slice(1)
      const e    = extra.join(', ')
      for (const k of tail) {
        acc = e
          ? `${this.op}(${acc}, ${k}, ${e})`
          : `${this.op}(${acc}, ${k})`
      }
      return acc
    }

    throw new Error(`Unsupported category "${category}" for "${this.op}"`)
  }

  _lit(v, wgslType, vec) {
    if (Array.isArray(v)) {
      const n = (wgslType.match(/^vec(\d+)f/) || [])[1] || v.length;
      const elems = v.map(el => this._fmtNum(el));
      return `${vec(n)}(${elems.join(', ')})`;
    }
    return this._fmtNum(v);
  }

  /** Always render a number with a decimal point if it doesn’t have one */
  _fmtNum(n) {
    let s = n.toString();
    // if no "." and not scientific (e.g. "1e-3"), append ".0"
    if (!s.includes('.') && !s.toLowerCase().includes('e')) s += '.0';
    return s;
  }

}

// --- SDFScene: owns ID pool & builds the whole tree ---
export class SDFScene {
  /**
   * @param {object} sceneJson  top-level node config
   */
  constructor(sceneJson) {
    if (!sceneJson) {
      throw new Error('SDFScene requires a valid scene JSON')
    }
    // Adapters to notify on changes
    this.adapters = new Set()
    // ID‐management state
    this.nextId = 1 // next fresh ID
    this.freeIds = [] // recycled IDs
    this.usedIds = new Set()

    // build the actual node tree
    this.root = new SDFNode(sceneJson, this, null)
  }

  registerAdapter(adapter) {
    this.adapters.add(adapter)
  }

  updateAdapters() {
    ;[...this.adapters].forEach((a) => a.sync())
  }

  /** reserve a user-provided ID */
  registerId(id) {
    const n = Number(id)
    if (!Number.isInteger(n) || n < 1) {
      throw new Error(`Invalid node ID: ${id}`)
    }
    if (this.usedIds.has(n)) {
      throw new Error(`Duplicate node ID: ${n}`)
    }
    this.usedIds.add(n)
    if (n >= this.nextId) {
      this.nextId = n + 1
    }
  }

  /** hand out the next available ID (recycling frees first) */
  allocateId() {
    let id
    if (this.freeIds.length) {
      this.freeIds.sort((a, b) => a - b)
      id = this.freeIds.shift()
    } else {
      id = this.nextId++
    }
    this.usedIds.add(id)
    return id
  }

  /** release a previously used ID back into the pool */
  releaseId(id) {
    const n = Number(id)
    if (this.usedIds.delete(n)) {
      this.freeIds.push(n)
    }
  }

  /**
   * Traverse the scene graph, invoking a callback on each node
   * @param {function(SDFNode): void} fn
   */
  traverse(fn) {
    const recurse = (node) => {
      fn(node)
      for (const c of node.children) recurse(c)
    }
    recurse(this.root)
  }

  /** Find a node anywhere by its integer ID */
  findNodeById(id) {
    let result = null
    this.traverse((node) => {
      if (node.id === id) result = node
    })
    return result
  }

  /**
   * Create a new node from SD_LIB template and attach under `parent`
   * @param {string} opName    one of the keys in SD_LIB
   * @param {SDFNode|number} parentOrId
   * @returns {SDFNode} the newly created node
   */

  addNode(parentOrId, opName) {
    const parent = typeof parentOrId === 'number' ? this.findNodeById(parentOrId) : parentOrId
    if (!parent) {
      throw new Error(`Parent node ${parentOrId} not found`)
    }
    const cfg = this._makeConfigFromLib(opName)
    let res = parent.addChild(cfg)
  }

  /**
   * Remove a node (and its subtree) by ID
   * @param {number} nodeId
   * @returns {boolean} true if removed
   */
  removeNodeById(nodeId) {
    const node = this.findNodeById(nodeId)
    if (!node) {
      throw new Error(`Node ${nodeId} not found`)
    }
    if (!node.parent) {
      throw new Error(`Cannot remove the root node`)
    }
    return node.parent.removeChild(node)
  }

  // —— internal helpers ——

  /** build a minimal config from the SD_LIB entry for `opName` */
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

  /** 0 for scalars, zero-filled arrays for vecNf */
  _defaultValueForType(type) {
    if (type === 'f32') return 0
    const m = type.match(/^vec(\d+)f$/)
    if (m) {
      return Array(parseInt(m[1], 10)).fill(0)
    }
    return null
  }

  /**
   * Duplicate a node (by instance or ID) under its current parent.
   * @param {SDFNode|number} nodeOrId
   * @param {boolean} recursive  if true, copy entire subtree
   * @returns {SDFNode}  the newly created clone
   */
  duplicateNode(nodeOrId, recursive = false) {
    const node = typeof nodeOrId === 'number' ? this.findNodeById(nodeOrId) : nodeOrId

    if (!node) {
      throw new Error(`Node ${nodeOrId} not found`)
    }
    if (!node.parent) {
      throw new Error(`Cannot duplicate the root node`)
    }

    // Ask the node to give us a config snapshot...
    const cfg = node.serialize(recursive)

    // ...and re-instantiate it under the same parent.
    return node.parent.addChild(cfg)
  }
}

// --- Adapter: keeps a Babylon.js scene in sync with an SDFScene ---
export class SDFBabylonAdapter {
  /**
   * @param {SDFScene} sdfScene
   * @param {BABYLON.Scene} babylonScene
   */
  constructor(sdfScene, babylonScene) {
    this.sdfScene = sdfScene
    this.babylonScene = babylonScene
    this.nodeMap = new Map() // maps SDFNode → Babylon Mesh
    this.sync()
  }

  // Traverses SDF graph to create/remove meshes as needed
  sync() {
    // Create meshes for new nodes
    this.sdfScene.traverse((node) => {
      if (!this.nodeMap.has(node)) {
        const mesh = this._createMeshFromNode(node)
        this.nodeMap.set(node, mesh)
      }
    })
    // Dispose meshes whose nodes have been removed
    for (let [node, mesh] of this.nodeMap) {
      if (!this._nodeStillInScene(node)) {
        mesh.dispose()
        this.nodeMap.delete(node)
      }
    }
  }

  _nodeStillInScene(node) {
    let found = false
    this.sdfScene.traverse((n) => {
      if (n === node) found = true
    })
    return found
  }

  // Always create a centered unit-box, then apply transforms
  _createMeshFromNode(node) {
    // 1) Create a unit cube centered at (0,0,0)
    const mesh = MeshBuilder.CreateBox(
      node.id || node.name || 'bbox',
      { size: 1 },
      this.babylonScene,
    )
    mesh.material = new StandardMaterial()
    mesh.material.alpha = 0
    mesh.name = node.name || `node_${node.id}`

    // 2) Apply any existing SDF modifiers (translate/rotate/scale)
    this._applyModifiersToMesh(node, mesh)

    // 3) SDF→Babylon: re-apply transforms on modifier change
    for (let mod of node.modifiers) {
      mod.onChange = () => this._applyModifiersToMesh(node, mesh)
    }

    // 4) Babylon→SDF: write back mesh transforms into modifiers
    mesh.registerAfterWorldMatrixUpdate(() => {
      const { x: px, y: py, z: pz } = mesh.position

      const {
        x: rx,
        y: ry,
        z: rz,
      } = mesh.rotationQuaternion ? mesh.rotationQuaternion.toEulerAngles() : mesh.rotation
      const { x: sx, y: sy, z: sz } = mesh.scaling
      this._writeBackModifier(node, 'opTranslate', [px, py, pz])
      this._writeBackModifier(node, 'opRotateX', rx)
      this._writeBackModifier(node, 'opRotateY', ry)
      this._writeBackModifier(node, 'opRotateZ', rz)
      this._writeBackModifier(node, 'opScale', sx)
    })

    return mesh
  }

  // Reads all four built-in modifiers and applies them to the mesh
  _applyModifiersToMesh(node, mesh) {
    const get = (op) => node.modifiers.find((m) => m.op === op)?.args
    const t = get('opTranslate')?.t ?? [0, 0, 0]
    const rx = get('opRotateX')?.a ?? 0
    const ry = get('opRotateY')?.a ?? 0
    const rz = get('opRotateZ')?.a ?? 0
    let opScale = get('opScale')
    let s = opScale ? [opScale.s, opScale.s, opScale.s] : [1, 1, 1]

    if (t) mesh.position.set(...t)
    mesh.rotation.set(rx, ry, rz)
    mesh.scaling.set(...s)
  }

  // Finds an existing modifier on the node and writes the new value
  _writeBackModifier(node, op, value) {
    // 1) find the modifier — if it doesn't exist, do nothing
    const mod = node.modifiers.find((m) => m.op === op)
    if (!mod) {
      return
    }

    // 2) helper to compare numbers or arrays
    const same = (oldVal, newVal) => {
      if (Array.isArray(oldVal) && Array.isArray(newVal) && oldVal.length === newVal.length) {
        return oldVal.every((v, i) => v === newVal[i])
      }
      return oldVal === newVal
    }

    // 3) grab the current stored value
    let current
    if (op === 'opTranslate') {
      current = mod.args.t
    } else if (op === 'opScale') {
      // our proxy stores scale as a single number s, but compare as [s]
      current = mod.args.s
    } else if (op === 'opRotateY' || op === 'opRotateX' || op === 'opRotateZ') {
      current = mod.args.a
    }

    // 4) if nothing changed, bail out
    if (same(current, value)) {
      return
    }

    if (op === 'opTranslate') {
      mod.args.t = value
    } else if (op === 'opScale') {
      mod.args.s = value
    } else if (op === 'opRotateY' || op === 'opRotateX' || op === 'opRotateZ') {
      mod.args.a = value
    }
  }
}

// --- Helper to generate both scenes together ---
export function generateSceneAndBabylonAdapter(babylonScene) {
  const sdf = new SDFScene(SCENE_DEF_JSON) // your SDFScene
  const adapter = new SDFBabylonAdapter(sdf, babylonScene)
  // whenever you add/remove nodes: call adapter.sync()
  return { sdf, adapter }
}
