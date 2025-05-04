import {
  WebGPUEngine,
  Scene,
  Vector3,
  MeshBuilder,
  Color3,
  HemisphericLight,
  ArcRotateCamera,
  Tools
} from '@babylonjs/core'
import { generateSceneAndBabylonAdapter } from "src/lib/classes"
import { HW_SCALING } from 'src/lib/defaults'
import { setupEditorView } from "src/lib/editor-controls"
import { setupRaymarchingPp } from "src/lib/postprocess"
const createScene = ({canvas, engine, scene}) => {
  scene.getEngine().setHardwareScalingLevel(HW_SCALING)
  scene.clearColor = new Color3(0.9, 1, 1.0)

  var camera = new ArcRotateCamera(
    'camera1',
    Math.PI / 2 + Math.PI / 7,
    Math.PI / 2,
    2,
    new Vector3(0, 20, 0),
    scene,
  )
  // This targets the camera to scene origin
  camera.setTarget(Vector3.Zero())

  // This attaches the camera to the canvas
  camera.attachControl(canvas, true)

  // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
  var light = new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  // Default intensity is 1. Let's dim the light a small amount
  light.intensity = 0.7

  // Our built-in 'sphere' shape.
  var sphere = MeshBuilder.CreateSphere('sphere', { diameter: 2, segments: 32 }, scene)

  // Move the sphere upward 1/2 its height
  sphere.position.y = 0
  sphere.position.x = 2
  sphere.position.z = 2
  sphere.scaling.setAll(0.3)

  let s2 = sphere.clone('test')
  s2.position.set(2, 0, 1.4)
  s2.scaling.set(0.2, 0.3, 0.23)
  let { sdf, adapter } = generateSceneAndBabylonAdapter(scene)

  setupEditorView(scene, camera) 
  let { shaderMaterial } = setupRaymarchingPp(scene, camera, light.direction, sdf)


  camera.beta = 1.3
  camera.alpha = Tools.ToRadians(135)
  camera.radius = 11

  engine.runRenderLoop(() => {
    scene.render()
  })
  return {scene, adapter, sdf_scene: sdf}
}

export { createScene }
