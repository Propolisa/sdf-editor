// src/lib/ReactiveSDF.js
import { shallowReactive } from 'vue'
import { SDFScene, SDFNode } from 'src/lib/classes'

// 1) A subclass that just ensures its own arrays are reactive
export class ReactiveSDFNode extends SDFNode {
  constructor(config, scene, parent) {
    super(config, scene, parent)
    // turn both arrays into Vue proxies
    this.children  = shallowReactive(this.children)
    this.modifiers = shallowReactive(this.modifiers)
  }

  // every time someone adds a child, make sure it also
  // gets wrapped in shallowReactive
  addChild(cfg) {
    const child = super.addChild(cfg)
    child.children  = shallowReactive(child.children)
    child.modifiers = shallowReactive(child.modifiers)
    // also swap its prototype so calls to any SDFNode method
    // delegate to ReactiveSDFNode
    Object.setPrototypeOf(child, ReactiveSDFNode.prototype)
    return child
  }
}

// 2) A scene subclass that bootstraps the whole tree
export class ReactiveSDFScene extends SDFScene {
  constructor(sceneJson) {
    super(sceneJson)
    // swap root’s class and wrap all existing nodes
    this._adoptRecursive(this.root)
  }

  // walk every node in the tree:
  _adoptRecursive(node) {
    // swap its prototype so that methods come from ReactiveSDFNode
    Object.setPrototypeOf(node, ReactiveSDFNode.prototype)
    // wrap the arrays (in case someone added raw children in the JSON)
    node.children  = shallowReactive(node.children)
    node.modifiers = shallowReactive(node.modifiers)
    // recurse
    for (const c of node.children) {
      this._adoptRecursive(c)
    }
  }

  // override addNode so that new nodes are also “adopted”
  addNode(parentOrId, opName) {
    const newNode = super.addNode(parentOrId, opName)
    this._adoptRecursive(newNode)
    return newNode
  }

  // same for duplicateNode
  duplicateNode(nodeOrId, recursive = false) {
    const dup = super.duplicateNode(nodeOrId, recursive)
    this._adoptRecursive(dup)
    return dup
  }
}
