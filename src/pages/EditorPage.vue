<template>
  <q-page class="relative">
    <!-- Babylon canvas + UI -->
    <q-layout class="fill">
      <div class="fill">
        <canvas id="canvas" ref="canvas" style="width: 100%; height: 100%;"></canvas>
      </div>

      <q-page-sticky position="top-right" :offset="[8, 8]">
        <q-select v-model="chosenTestScene" :options="testSceneNames" style="max-width: 120px" label="Scene" outlined
          dense class="sticky-select" />
      </q-page-sticky>
    </q-layout>

    <!-- Your overlay remains here -->
    <EditorOverlay />
  </q-page>
</template>

<script>
import { Scene, WebGPUEngine } from "@babylonjs/core"
import { createScene as createEditorScene } from "src/scenes/sdf-editor.js"
import EditorOverlay from "src/components/EditorOverlay.vue"

export default {
  name: "EditorPage",
  components: { EditorOverlay },
  data() {
    return {
      TEST_SCENES: { editor: createEditorScene },
      chosenTestScene: "editor",
      adapter: null,
      sdf_scene: null,
      engine: null,
      scene: null,
    }
  },
  computed: {
    testSceneNames() {
      return Object.keys(this.TEST_SCENES)
    },
  },
  async mounted() {
    await this.resetBabylon()
    this.TEST_SCENES[this.chosenTestScene]({
      engine: this.engine,
      canvas: this.$refs.canvas,
      scene: this.scene,
    })
  },
  watch: {
    chosenTestScene: {
      handler: async function (newScene, oldScene) {
        if (newScene === oldScene) return
        await this.resetBabylon()
        const { adapter, sdf_scene } = this.TEST_SCENES[newScene]({
          engine: this.engine,
          canvas: this.$refs.canvas,
          scene: this.scene,
        })
        this.adapter = adapter
        this.sdf_scene = sdf_scene
      },
      immediate: false,
    },
  },
  provide() {
        return {
            sdf_scene: this.sdf_scene,
            adapter: this.adapter
        }
    },
  methods: {
    async resetBabylon() {
      if (this.engine) {
        this.engine.dispose()
      }
      if (this.scene) {
        this.scene.dispose()
      }
      this.engine = new WebGPUEngine(this.$refs.canvas, { antialias: true })
      await this.engine.initAsync()
      this.scene = new Scene(this.engine)
    },
  },
}
</script>

<style scoped>
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
</style>
