import {
  StandardMaterial,
  MeshBuilder,
  Matrix,
  Quaternion,
  Vector3,
  UtilityLayerRenderer,
  BoundingBoxGizmo,
  Color3,
  SixDofDragBehavior,
  MultiPointerScaleBehavior,
} from '@babylonjs/core'

// --- Adapter: keeps a Babylon.js scene in sync with an SDFScene and manages bounding-box gizmos ---
export class SDFBabylonAdapter {
  /**
   * @param {SDFScene} sdfScene
   * @param {BABYLON.Scene} babylonScene
   */
  constructor(sdfScene, babylonScene) {
    this.dummy = new MeshBuilder.CreateBox("unattached_pointer", {size:.5}, babylonScene)
    this.dummy.isVisible = true
    this.sdfScene = sdfScene
    this.babylonScene = babylonScene
    this.nodeMap = new Map() // SDFNode -> Mesh
    this._gizmoMap = new Map() // SDFNode -> BoundingBoxGizmo

    // // Utility layer for all gizmos
    // this._utilLayer = new UtilityLayerRenderer(this.babylonScene)
    // this._utilLayer.setRenderCamera(babylonScene.activeCamera)
    // this._utilLayer.utilityLayerScene.autoClearDepthAndStencil = false

    // Listen for selection changes to show/hide gizmos
    // this.sdfScene.onNodeSelectedObservable.add(([newId, oldId]) => {
    //   const newNode = this._getNodeById(newId)
    //   const oldNode = this._getNodeById(oldId || 0)
    //   // Hide gizmo for previously selected node
    //   if (oldNode && this._gizmoMap.has(oldNode)) {
    //     this._gizmoMap.get(oldNode).attachedMesh = this.dummy
    //   }
    //   // Show gizmo for newly selected node
    //   if (newNode && this._gizmoMap.has(newNode)) {
    //     const mesh = this.nodeMap.get(newNode)
    //     this._gizmoMap.get(newNode).attachedMesh = mesh
    //   }
    // })

    this.sync()
  }

  // Traverses SDF graph to create/remove meshes as needed
  sync() {
    // Create meshes for new nodes, and their gizmos
    this.sdfScene.traverse((node) => {
      if (!this.nodeMap.has(node)) {
        const mesh = this._createMeshFromNode(node)
        this.nodeMap.set(node, mesh)

        // Create a gizmo but don't attach it until selection
        const gizmo = new BoundingBoxGizmo(Color3.FromHexString('#0984e3'))
        gizmo.attachedMesh = this.dummy
        this._gizmoMap.set(node, gizmo)
      }
    })
    // Dispose meshes & gizmos whose nodes have been removed
    for (let [node, mesh] of this.nodeMap) {
      if (!this._nodeStillInScene(node)) {
        mesh.dispose()
        this.nodeMap.delete(node)
        // also clean up gizmo
        const g = this._gizmoMap.get(node)
        if (g) {
          g.dispose()
          this._gizmoMap.delete(node)
        }
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

  _getNodeById(id) {
    let result = null
    this.sdfScene.traverse((n) => {
      if (n.id === id || n.name === id) {
        result = n
      }
    })
    return result
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
    mesh.name = `node_${node.id}`

    // 2) Apply any existing SDF modifiers (translate/rotate/scale)
    this._applyModifiersToMesh(node, mesh)

    // 3) Re-apply transforms on modifier change
    for (let mod of node.modifiers) {
      mod.onChange = () => this._applyModifiersToMesh(node, mesh)
    }

    // 4) Update node modifiers after world-matrix changes
    mesh.registerAfterWorldMatrixUpdate(() => {
      const { x: px, y: py, z: pz } = mesh.position
      const {
        x: rx,
        y: ry,
        z: rz,
      } = mesh.rotationQuaternion ? mesh.rotationQuaternion.toEulerAngles() : mesh.rotation
      const { x: sx } = mesh.scaling

      function almostEquals(val, target, threshold=0.00001){
        return Math.abs(target - val) < threshold
      }
      const need = {
        opTranslate: !almostEquals(px, 0) || !almostEquals(py, 0)  || !almostEquals(pz, 0) ,
        opRotateX: !almostEquals(rx, 0),
        opRotateY: !almostEquals(ry, 0),
        opRotateZ: !almostEquals(rz, 0),
        opScale: !almostEquals(sx, 1),
      }
      const hasMod = (op) => node.modifiers.some((m) => m.op === op)
      const missingAny = Object.entries(need).some(([op, needed]) => needed && !hasMod(op))

      if (missingAny || hasMod('opTransform')) {
        // Use full transform matrix
        node.modifiers = node.modifiers.filter(
          (m) => !['opTranslate', 'opRotateX', 'opRotateY', 'opRotateZ', 'opScale'].includes(m.op),
        )
        const inv = mesh.getWorldMatrix().clone().invert()
        const M = inv.m
        const transform = [...M]
        let tf = node.modifiers.find((m) => m.op === 'opTransform')
        if (tf) {
          tf.args.transform = transform
        } else {
          node.modifiers.push({ op: 'opTransform', args: { transform } })
        }
      } else {
        this._writeBackModifier(node, 'opTranslate', [px, py, pz])
        this._writeBackModifier(node, 'opRotateX', rx)
        this._writeBackModifier(node, 'opRotateY', ry)
        this._writeBackModifier(node, 'opRotateZ', rz)
        this._writeBackModifier(node, 'opScale', sx)
        node.modifiers = node.modifiers.filter((m) => m.op !== 'opTransform')
      }
    })

    return mesh
  }

  _applyModifiersToMesh(node, mesh) {
    const tfMod = node.modifiers.find((m) => m.op === 'opTransform')
    if (tfMod) {
      const invMat = Matrix.FromArray(tfMod.args.transform)
      const worldMat = invMat.clone().invert()
      const scaling = new Vector3(),
        rotationQuaternion = new Quaternion(),
        translation = new Vector3()
      worldMat.decompose(scaling, rotationQuaternion, translation)
      mesh.position.copyFrom(translation)
      mesh.scaling.copyFrom(scaling)
      mesh.rotationQuaternion = rotationQuaternion
      mesh.computeWorldMatrix(true)
      return
    }
    const get = (op) => node.modifiers.find((m) => m.op === op)?.args
    const t = get('opTranslate')?.t ?? [0, 0, 0]
    const rx = get('opRotateX')?.a ?? 0
    const ry = get('opRotateY')?.a ?? 0
    const rz = get('opRotateZ')?.a ?? 0
    const sArg = get('opScale')?.s ?? 1
    const s = sArg != null ? [sArg, sArg, sArg] : [1, 1, 1]
    mesh.position.set(...t)
    mesh.rotation.set(rx, ry, rz)
    mesh.scaling.set(...s)
    mesh.computeWorldMatrix(true)
  }

  _writeBackModifier(node, op, value) {
    const mod = node.modifiers.find((m) => m.op === op)
    if (!mod) return
    const same = (oldVal, newVal) =>
      Array.isArray(oldVal)
        ? oldVal.length === newVal.length && oldVal.every((v, i) => v === newVal[i])
        : oldVal === newVal
    let current = op === 'opTranslate' ? mod.args.t : op === 'opScale' ? mod.args.s : mod.args.a
    if (same(current, value)) return
    if (op === 'opTranslate') mod.args.t = value
    else if (op === 'opScale') mod.args.s = value
    else mod.args.a = value
  }
}

import { SDFScene } from './classes'
import { BLOBBY } from './scenes'

export function generateSceneAndBabylonAdapter(sdfScene, babylonScene) {
  const adapter = new SDFBabylonAdapter(sdfScene, babylonScene)
  return { sdf: sdfScene, adapter }
}
