import { Color3, MeshBuilder, Scene, Vector3 } from '@babylonjs/core'
import { GridMaterial } from '@babylonjs/materials'
import { toRef, watch } from 'vue'

export function setupSceneGrid(scene, { global_settings }) {
  const camera = scene.activeCamera
  const gridSize = 20000
  scene.fogMode = Scene.FOGMODE_LINEAR
  scene.fogStart = 20.0
  scene.fogEnd = gridSize
  camera.maxZ = gridSize

  const baseOpacity = 0.25

  // Define your 6 plane‐normals (+Y only once)
  const planeDefs = [
    { name: 'grid_Y+', normal: new Vector3(0, 1, 0), rotation: Vector3.Zero() },
    { name: 'grid_Y-', normal: new Vector3(0, -1, 0), rotation: new Vector3(Math.PI, 0, 0) },
    { name: 'grid_X+', normal: new Vector3(1, 0, 0), rotation: new Vector3(0, 0, -Math.PI / 2) },
    { name: 'grid_X-', normal: new Vector3(-1, 0, 0), rotation: new Vector3(0, 0, Math.PI / 2) },
    { name: 'grid_Z+', normal: new Vector3(0, 0, 1), rotation: new Vector3(Math.PI / 2, 0, 0) },
    { name: 'grid_Z-', normal: new Vector3(0, 0, -1), rotation: new Vector3(-Math.PI / 2, 0, 0) },
  ]

  // Create grids
  const grids = planeDefs.map((def) => {
    const mesh = MeshBuilder.CreateGround(def.name, { width: gridSize, height: gridSize }, scene)
    mesh.rotation = def.rotation
    mesh.position = Vector3.Zero()

    const mat = new GridMaterial(def.name + 'Mat', scene)
    mat.mainColor = new Color3(0.18, 0.18, 0.27)
    mat.lineColor = new Color3(0.3, 0.3, 0.3)
    mat.backFaceCulling = false
    mat.opacity = baseOpacity

    mesh.material = mat
    return { normal: def.normal, mesh, material: mat }
  })

  // Define & create axes
  const axisDefs = [
    {
      name: 'axisX',
      points: [new Vector3(-gridSize / 2, 0, 0), new Vector3(gridSize / 2, 0, 0)],
      color: new Color3(1, 0, 0),
      dir: new Vector3(1, 0, 0),
    },
    {
      name: 'axisY',
      points: [new Vector3(0, -gridSize / 2, 0), new Vector3(0, gridSize / 2, 0)],
      color: new Color3(0, 1, 0),
      dir: new Vector3(0, 1, 0),
    },
    {
      name: 'axisZ',
      points: [new Vector3(0, 0, -gridSize / 2), new Vector3(0, 0, gridSize / 2)],
      color: new Color3(0, 0, 1),
      dir: new Vector3(0, 0, 1),
    },
  ]

  const axes = axisDefs.map((def) => {
    const lines = MeshBuilder.CreateLines(
      def.name,
      { useVertexAlpha: true, points: def.points },
      scene,
    )
    lines.color = def.color
    lines.alpha = baseOpacity
    return { dir: def.dir, mesh: lines }
  })

  // Helper to toggle visibility
  function toggleAll(show) {
    grids.forEach(({ mesh }) => mesh.setEnabled(show))
    axes.forEach(({ mesh }) => mesh.setEnabled(show))
  }

  // Watch the setting
  watch(
    toRef(global_settings.display, 'show_world_grid'),
    (newVal) => {
      toggleAll(!!newVal)
    },
    { immediate: true },
  )

  // Fade logic per frame
  scene.onBeforeRenderObservable.add(() => {
    if (!global_settings.display.show_world_grid) {
      return
    }

    const forward = camera.getTarget().subtract(camera.position).normalize()
    const thresholdDot = 0.99
    const exponent = 2

    // Fade grids
    grids.forEach(({ normal, material }) => {
      const d = Math.abs(Vector3.Dot(forward, normal))
      const t = (d - thresholdDot) / (1 - thresholdDot)
      const m = Math.max(0, Math.min(1, t))
      material.opacity = baseOpacity * Math.pow(m, exponent)
    })

    // Fade axes when edge‐on
    const thresholdPerp = 0.4
    axes.forEach(({ dir, mesh }) => {
      const d = Math.abs(Vector3.Dot(forward, dir))
      const dPerp = 1 - d
      const t = (dPerp - thresholdPerp) / (1 - thresholdPerp)
      const m = Math.max(0, Math.min(1, t))
      mesh.alpha = 0.5 * Math.pow(m, exponent)
    })
  })
}
