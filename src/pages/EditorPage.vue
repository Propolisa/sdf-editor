<template>
  <q-page class="relative">
    <q-layout class="fill">
      <EditorOverlay ref="vue_overlay" id="vue_overlay">
        <canvas id="canvas" ref="canvas" class="fit"></canvas>
        <q-resize-observer @resize="onResize" />
      </EditorOverlay>
    </q-layout>
  </q-page>
</template>

<script setup>
import {
  ref,
  reactive,
  watch,
  computed,
  markRaw,
  onMounted,
  onBeforeUnmount,
  provide,
  toRef,
  shallowReactive
} from "vue"
import { useScenesStore } from "src/stores/scenes"
import EditorOverlay from "src/components/EditorOverlay.vue"
import {
  WebGPUEngine,
  Scene,
  Vector3,
  MeshBuilder,
  Color3,
  HemisphericLight,
  ArcRotateCamera,
  Tools
} from "@babylonjs/core"
import { generateSceneAndBabylonAdapter } from "src/lib/sdf-object-mesh-adapter"
import { setupEditorView } from "src/lib/editor-controls"
import { setupRaymarchingPp } from "src/lib/postprocess"
import { setupSceneGrid } from "src/lib/setup-scene-grid"
import { SDFScene } from "src/lib/classes"
import { ReactiveSDFScene } from "src/lib/reactive-classes"

// 1) ALL REFS & STORE
const canvas = ref(null)
const vue_overlay = ref(null)

const engine = ref(null)
const scene = ref(null)
const sdf_scene = ref(null)
const adapter = ref(null)

const store = useScenesStore()

// reactive app-level settings & state
const global_settings = reactive({
  display: {
    mode: "raymarch",
    raymarch: { epsilon: 0.005, adaptive_epsilon: true, max_steps: 70, max_dist: 300 },
    resolution_multiplier: 3,
    show_world_grid: true,
    disable_animations: false,
    render_only_on_change: true
  }
})
const state = reactive({
  selected_shape_id: 0,
  selected_shape_id_buffer: 0,
  trigger_redraw: 1
})

// keep focus on canvas when shape changes
watch(toRef(state, "selected_shape_id"), () => {
  canvas.value?.focus()
})

// 2) HELPERS
function onResize() {
  engine.value?.resize()
}

async function resetBabylon() {
  if (scene.value) await scene.value.dispose()
  if (engine.value) engine.value?.dispose()
  engine.value = new WebGPUEngine(canvas.value, { antialias: true })
  await engine.value.initAsync()

  scene.value = new Scene(engine.value)
}

function setupCamera(scene, canvas) {
  const camera = new ArcRotateCamera(
    "camera1",
    Math.PI / 2 + Math.PI / 7,
    Math.PI / 2,
    2,
    new Vector3(0, 20, 0),
    scene
  )
  camera.setTarget(Vector3.Zero())
  camera.attachControl(canvas, true)

  camera.onViewMatrixChangedObservable.add(() => {
    state.trigger_redraw = 3
  })

  camera.onProjectionMatrixChangedObservable.add(() => {
    state.trigger_redraw = 3
  })

  return camera
}

async function initializeScene() {
  const activeId = store.activeScene
  if (!activeId) {
    console.warn("No activeScene set; skipping.")
    return
  }

  // parse the JSON for this scene
  const rec = store.scenes[activeId]
  let sceneData = {}
  try {
    sceneData = JSON.parse(rec.current || "{}")
  } catch (err) {
    console.error("Invalid scene JSON:", err)
  }

  // tear down & rebuild
  await resetBabylon()

  // apply resolution immediately
  watch(
    () => global_settings.display.resolution_multiplier,
    (v) => engine.value.setHardwareScalingLevel(v),
    { immediate: true }
  )

  scene.value.clearColor = new Color3(0.9, 1, 1.0)

  let camera = setupCamera(scene.value, canvas.value)

  const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene.value)
  light.intensity = 0.7

  // // sample geometry
  // const sphere = MeshBuilder.CreateSphere(
  //   "sphere",
  //   { diameter: 2, segments: 32 },
  //   scene.value
  // )
  // sphere.position.set(2, 0, 2)
  // sphere.scaling.setAll(0.3)
  // const s2 = sphere.clone("test")
  // s2.position.set(2, 0, 1.4)
  // s2.scaling.set(0.2, 0.3, 0.23)

  setupSceneGrid(scene.value, { global_settings })

  // your dynamic SDFScene Reactive
  const sdfObj = new ReactiveSDFScene(sceneData)

  sdfObj.onNeedsRedrawObservable.add(() => {
    state.trigger_redraw = 1
  })
  // recursively replace every node.children with a reactive array:
  function makeTreeReactive(node) {
    node.children = shallowReactive(node.children)
    for (const c of node.children) {
      makeTreeReactive(c)
    }
  }

  makeTreeReactive(sdfObj.root)
  const reactiveScene = reactive(sdfObj)
  sdf_scene.value = reactiveScene

  const { adapter: bazAdapter, sdf } = generateSceneAndBabylonAdapter(sdfObj, scene.value)
  adapter.value = markRaw(bazAdapter)
  sdf.registerAdapter(bazAdapter)

  setupRaymarchingPp(scene.value, camera, light.direction, sdf, global_settings, state)
  setupEditorView(scene.value, camera, global_settings, state, sdf)

  camera.beta = 1.3
  camera.alpha = Tools.ToRadians(135)
  camera.radius = 11

  engine.value.runRenderLoop(() => {
    camera.update()
    if (!global_settings.display.render_only_on_change || state.trigger_redraw >= 0)
      scene.value.render(false, true)
    state.trigger_redraw--
  })
}

// 3) LIFECYCLE
onMounted(() => {
  window.addEventListener("resize", onResize)

  // run once now that canvas.value is guaranteed to exist
  initializeScene()

  // re-run on every activeScene change (no immediate)
  watch(
    () => store.activeScene,
    () => {
      initializeScene()
    }
  )
})

onBeforeUnmount(() => {
  window.removeEventListener("resize", onResize)
  engine.value?.stopRenderLoop()
  scene.value?.dispose()
  engine.value?.dispose()
  scene.value = null
  engine.value = null
})

// 4) PROVIDE
provide(
  "global_settings",
  computed(() => global_settings)
)
provide(
  "sdf_scene",
  computed(() => sdf_scene.value)
)
provide(
  "adapter",
  computed(() => adapter.value)
)
provide(
  "state",
  computed(() => state)
)
</script>

<style scoped>
#vue_overlay {
  font-family: "Atkinson Hyperlegible Next";
  font-weight: 300;
}
.fill {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
}
.relative {
  position: relative;
}
#canvas {
  outline: none;
}
</style>
