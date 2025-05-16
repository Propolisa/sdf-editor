<template>
  <q-page class="relative">
    <!-- Babylon canvas + UI -->
    <q-layout class="fill">
      <!-- Your overlay remains here -->

      <EditorOverlay ref="vue_overlay" id="vue_overlay">
        <canvas id="canvas" ref="canvas" class="fit"></canvas>
        <q-resize-observer @resize="onResize" />
      </EditorOverlay>

      <q-page-sticky position="top-right" :offset="[8, 8]">
        <!-- <q-select v-model="chosenTestScene" :options="testSceneNames" style="max-width: 120px" label="Scene" outlined
          dense class="sticky-select" /> -->
      </q-page-sticky>
    </q-layout>
  </q-page>
</template>

<script setup>
import { ref, reactive, computed, markRaw, onMounted, onBeforeUnmount, provide, toRef } from 'vue'
import EditorOverlay from 'src/components/EditorOverlay.vue'
import {
  WebGPUEngine,
  Scene,
  Vector3,
  MeshBuilder,
  Color3,
  HemisphericLight,
  ArcRotateCamera,
  Tools,
  GizmoManager,
} from '@babylonjs/core'
import { generateSceneAndBabylonAdapter } from 'src/lib/classes'
import { setupEditorView } from 'src/lib/editor-controls'
import { setupRaymarchingPp } from 'src/lib/postprocess'
import { watch } from 'vue'

// refs to template elements
const canvas = ref(null)
const vue_overlay = ref(null)

// reactive state
const global_settings = reactive({
  display: {
    mode: 'raymarch',
    raymarch: { epsilon: 0.001, adaptive_epsilon: true },
    resolution_multiplier: 3
  }
})

const state = reactive({
  selected_shape_id: 0,
  selected_shape_id_buffer: 0
})
watch(
  toRef(state, "selected_shape_id"),
  (newValue, oldValue) => {
    canvas.value.focus()
  }

)


const adapter = ref(null)
const sdf_scene = ref(null)
const callbacks = ref(null)
const engine = ref(null)
const scene = ref(null)

// resize handler
function onResize() {
  engine.value?.resize()
}



// initialize or re-create Babylon engine & scene
async function resetBabylon() {
  if (engine.value) {
    engine.value.dispose()
  }
  if (scene.value) {
    scene.value.dispose()
  }
  engine.value = new WebGPUEngine(canvas.value, { antialias: true })
  await engine.value.initAsync()
  scene.value = new Scene(engine.value)
}


// lifecycle hooks
onMounted(async () => {
  window.addEventListener('resize', onResize)
  await resetBabylon()


  watch(
    toRef(global_settings.display, 'resolution_multiplier'),
    (newValue, oldValue) => {
      engine.value.setHardwareScalingLevel(global_settings.display.resolution_multiplier)
    },
    { immediate: true },
  )

  scene.value.clearColor = new Color3(0.9, 1, 1.0)

  var camera = new ArcRotateCamera(
    'camera1',
    Math.PI / 2 + Math.PI / 7,
    Math.PI / 2,
    2,
    new Vector3(0, 20, 0),
    scene.value,
  )
  // This targets the camera to scene origin
  camera.setTarget(Vector3.Zero())

  // This attaches the camera to the canvas
  camera.attachControl(canvas, true)

  // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
  var light = new HemisphericLight('light', new Vector3(0, 1, 0), scene.value)

  // Default intensity is 1. Let's dim the light a small amount
  light.intensity = 0.7

  // Our built-in 'sphere' shape.
  var sphere = MeshBuilder.CreateSphere('sphere', { diameter: 2, segments: 32 }, scene.value)

  // Move the sphere upward 1/2 its height
  sphere.position.y = 0
  sphere.position.x = 2
  sphere.position.z = 2
  sphere.scaling.setAll(0.3)

  let s2 = sphere.clone('test')
  s2.position.set(2, 0, 1.4)
  s2.scaling.set(0.2, 0.3, 0.23)
  let { sdf, adapter: _adapter } = generateSceneAndBabylonAdapter(scene.value)
  sdf_scene.value = sdf
  adapter.value = markRaw(_adapter)
  sdf.registerAdapter(_adapter)
  let { shaderMaterial } = setupRaymarchingPp(scene.value, camera, light.direction, sdf, global_settings, state)

  setupEditorView(scene.value, camera, global_settings, state, sdf)
  camera.beta = 1.3
  camera.alpha = Tools.ToRadians(135)
  camera.radius = 11

  engine.value.runRenderLoop(() => {
    scene.value.render()
  })

  // watch(
  //   global_settings.display.resolution_multiplier,
  //   (newValue, oldValue) => {
  //     scene.getEngine().setHardwareScalingLevel(global_settings.display.resolution_multiplier)
  //   },
  //   { immediate: true },
  // )
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  engine.value?.stopRenderLoop()
  scene.value?.dispose()
  engine.value?.dispose()
})


// provide reactive values to descendants
provide('global_settings', computed(() => global_settings))
provide('sdf_scene', computed(() => sdf_scene.value))
provide('adapter', computed(() => adapter.value))
provide('state', computed(() => state))
</script>

<style scoped>
#vue_overlay {
  font-family: 'Atkinson Hyperlegible Next', sans-serif;
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
  outline: none
}
</style>
