import { SDFScene } from './classes'
import { BLOBBY } from './scenes'

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

    // 4) Babylon→SDF: update node modifiers after the world matrix changes
    mesh.registerAfterWorldMatrixUpdate(() => {
      // 4.1) Extract current TRS from the mesh
      const { x: px, y: py, z: pz } = mesh.position
      const {
        x: rx,
        y: ry,
        z: rz,
      } = mesh.rotationQuaternion ? mesh.rotationQuaternion.toEulerAngles() : mesh.rotation
      const { x: sx } = mesh.scaling // assume uniform scale

      // 4.2) Determine which primitive ops are actually needed
      const need = {
        opTranslate: px !== 0 || py !== 0 || pz !== 0,
        opRotateX: rx !== 0,
        opRotateY: ry !== 0,
        opRotateZ: rz !== 0,
        opScale: sx !== 1,
      }

      // helper to check for existing modifier
      const hasMod = (op) => node.modifiers.some((m) => m.op === op)

      // 4.3) If *any* needed primitive is missing, fall back to opTransform
      const missingAny = Object.entries(need).some(([op, needed]) => needed && !hasMod(op))

      if (missingAny || hasMod('opTransform')) {
        // strip out all primitive modifiers
        node.modifiers = node.modifiers.filter(
          (m) => !['opTranslate', 'opRotateX', 'opRotateY', 'opRotateZ', 'opScale'].includes(m.op),
        )

        // compute inverse world matrix and flatten into a 16-array
        const inv = mesh.getWorldMatrix().clone().invert()
        const M = inv.m // row-major 16-element array
        const transform = [
          M[0],
          M[1],
          M[2],
          M[3],
          M[4],
          M[5],
          M[6],
          M[7],
          M[8],
          M[9],
          M[10],
          M[11],
          M[12],
          M[13],
          M[14],
          M[15],
        ]

        // upsert opTransform
        let tf = node.modifiers.find((m) => m.op === 'opTransform')
        if (tf) {
          tf.args.transform = transform
        } else {
          node.modifiers.push({ op: 'opTransform', args: { transform } })
        }
      } else {
        // all needed primitives exist → update them
        this._writeBackModifier(node, 'opTranslate', [px, py, pz])
        this._writeBackModifier(node, 'opRotateX', rx)
        this._writeBackModifier(node, 'opRotateY', ry)
        this._writeBackModifier(node, 'opRotateZ', rz)
        this._writeBackModifier(node, 'opScale', sx)

        // remove any stale opTransform so it doesn’t override
        node.modifiers = node.modifiers.filter((m) => m.op !== 'opTransform')
      }
    })

    return mesh
  }

  // Reads all modifiers and applies them to the mesh
  _applyModifiersToMesh(node, mesh) {
    const tfMod = node.modifiers.find((m) => m.op === 'opTransform')
    if (tfMod) {
      // tfMod.args.transform is a 16-element row-major *inverse* world-matrix
      const invMat = Matrix.FromArray(tfMod.args.transform)
      const worldMat = invMat.clone().invert()

      // prepare mutable holders for decompose
      const scaling = new Vector3()
      const rotationQuaternion = new Quaternion()
      const translation = new Vector3()

      // decompose into S, R, T
      worldMat.decompose(scaling, rotationQuaternion, translation)

      // apply to mesh
      mesh.position.copyFrom(translation)
      mesh.scaling.copyFrom(scaling)
      mesh.rotationQuaternion = rotationQuaternion

      return
    }

    // fallback to primitive modifiers
    const get = (op) => node.modifiers.find((m) => m.op === op)?.args
    const t = get('opTranslate')?.t ?? [0, 0, 0]
    const rx = get('opRotateX')?.a ?? 0
    const ry = get('opRotateY')?.a ?? 0
    const rz = get('opRotateZ')?.a ?? 0
    const sArg = get('opScale')?.s
    const s = sArg != null ? [sArg, sArg, sArg] : [1, 1, 1]

    mesh.position.set(...t)
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

import { StandardMaterial, MeshBuilder, Matrix, Quaternion, Vector3 } from '@babylonjs/core'
// --- Helper to generate both scenes together ---
export function generateSceneAndBabylonAdapter(sdfScene, babylonScene) {
  const adapter = new SDFBabylonAdapter(sdfScene, babylonScene)
  // whenever you add/remove nodes: call adapter.sync()
  return { sdf: sdfScene, adapter }
}
