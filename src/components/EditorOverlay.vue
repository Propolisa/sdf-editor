<template>
  <q-splitter
    before-class="sdfe-do-not-overflow"
    after-class="se_panel_root"
    class="absolute-full"
    :horizontal="orientation == 'portrait-primary' || orientation ==  'portrait-secondary' ? true : false"
    v-model="splitWidth"
  >
    <template #before>
      <!-- Draggable FAB in the bottom-right corner -->
      <div class="">
        <q-page-sticky class="q-pa-md" style="z-index: 99999" position="top-left">
          <SceneSelector />
          <div>
            <q-btn
              @click="showSettings = true"
              fab-mini
              icon="mdi-cog-outline"
              flat
              style="color: #181818"
            />
          </div>
          <div>
            <q-btn
              @click="showCheatSheet = true"
              fab-mini
              icon="mdi-help-circle-outline"
              flat
              style="color: #181818"
            />
          </div>
        </q-page-sticky>
      </div>
      <!-- Settings & Cheat‐sheet modals -->
      <GlobalSettingsModal v-model="showSettings" />
      <CheatSheetOverlay v-model="showCheatSheet" />

      <slot />
    </template>
    <template #after v-if="sdf_scene">
      <q-splitter
        before-class="se_panel"
        after-class="se_panel"
        id="splitter_view"
        v-model="splitPanelHeight"
         :horizontal="orientation == 'portrait-primary' || orientation ==  'portrait-secondary' ? undefined : true"
        :limits="[20, 80]"
      >
        <template #before>
          <q-scroll-area class="scene-tree" style="height: 100%">
            <TreeNode :node="sdf_scene.root" :selected="selected" />
          </q-scroll-area>
        </template>

        <template #after>
          <div class="prop-container" style="height: 100%">
            <q-tabs dark vertical dense class="icon-tabs" v-model="activeTab">
              <q-tab name="object" icon="mdi-cube-outline" />
              <q-tab name="material" icon="mdi-palette-outline" />
              <q-tab name="modifiers" icon="mdi-cog-outline" />
            </q-tabs>

            <q-tab-panels
              dark
              vertical
              class="bg-transparent tab-content"
              v-model="activeTab"
            >
              <q-tab-panel name="object">
                <q-form dense dark v-if="selected">
                  <!-- Basic fields -->
                  <q-input
                    dense
                    dark
                    v-model="selected.name"
                    label="Name"
                    class="q-mb-sm"
                  />
                  <q-input dense dark v-model="selected.op" label="Op" class="q-mb-sm" />

                  <!-- args: inline label + editor via q-field -->
                  <div class="row wrap">
                    <q-field
                      v-for="(val, key) in selected.args"
                      :key="key"
                      :label="key"
                      label-always
                      dense
                      class="q-mr-md q-mb-sm"
                      label-class="text-caption text-white"
                    >
                      <vector-or-scalar-editor v-model="selected.args[key]" />
                    </q-field>
                  </div>
                </q-form>
              </q-tab-panel>

              <q-tab-panel name="material">
                <div v-if="selected?.material">
                  <q-color dense dark v-model="colorModel" format-model="rgba" flat />
                </div>
                <div v-else>No material</div>
              </q-tab-panel>

              <q-tab-panel v-if="selected" name="modifiers">
                <!-- Add-child dropdown, only for group nodes -->
                <q-btn-dropdown
                  ref="dropdowns"
                  :ref-key="i"
                  dense
                  dropdown-icon="none"
                  size="sm"
                  flat
                  style="pointer-events: auto"
                >
                  <template v-slot:label>
                    <q-icon name="mdi-plus" />
                  </template>

                  <!-- pass the index along so the handler knows which to close -->
                  <LibraryPicker @set-model="(val) => onModifierPick(val, i)" />
                </q-btn-dropdown>
                <template v-if="selected?.modifiers?.length">
                  <div
                    v-for="(m, i) in selected.modifiers"
                    :key="i"
                    class="modifier-item q-mb-md q-pa-sm bg-grey-8 rounded"
                  >
                    <!-- Op field -->
                    <q-input
                      dense
                      dark
                      filled
                      v-model="m.op"
                      label="Op"
                      class="q-mb-sm"
                    />
                    <q-btn
                      text-color="white"
                      size="xs"
                      dense
                      flat
                      round
                      icon="mdi-delete-outline"
                      @click.stop="selected.removeModifier(i)"
                      style="pointer-events: auto"
                    />

                    <!-- args: inline label + editor -->
                    <div class="row wrap">
                      <div
                        v-for="(val, key) in m.args"
                        :key="key"
                        class="row items-center q-mr-md q-mb-sm"
                      >
                        <div class="text-caption text-white q-mr-sm">
                          {{ key }}
                        </div>
                        <vector-or-scalar-editor
                          v-model="m.args[key]"
                          :wgslType="m?.def?.args[key]"
                        />
                      </div>
                    </div>
                  </div>
                </template>
                <template v-else> No modifiers </template>
              </q-tab-panel>
            </q-tab-panels>
          </div>
        </template>
      </q-splitter>
    </template>
  </q-splitter>
</template>

<script>
import SD_LIB from "src/lib/sd-lib"
import { ref, watch as vueWatch } from "vue" // only if you still need watch in setup of other comps
import TreeNode from "./TreeNode.vue"
import LibraryPicker from "./LibraryPicker.vue"
import VectorOrScalarEditor from "./VectorOrScalarEditor.vue"
import CheatSheetOverlay from "./CheatSheetOverlay.vue"
import GlobalSettingsModal from "./GlobalSettings.vue"
import SceneSelector from "./SceneSelector.vue"
import { useScreenOrientation } from "@vueuse/core"

export default {
  name: "EditorOverlay",
  components: {
    SceneSelector,
    TreeNode,
    VectorOrScalarEditor,
    LibraryPicker,
    CheatSheetOverlay,
    GlobalSettingsModal
  },

  inject: ["sdf_scene", "adapter", "state"],
  setup() {
    const { orientation } = useScreenOrientation()

    return { orientation }
  },

  
  data() {
    return {
      // splitters
      splitWidth: 70,
      splitPanelHeight: 50,

      // selection & props panel
      selected: null,
      activeTab: "object",

      // drag/drop
      draggingId: null,

      // FAB state
      fabPos: [18, 18],
      draggingFab: false,

      // dialog flags
      showSettings: false,
      showCheatSheet: false
    }
  },

  watch: {
    orientation(n,o){debugger},
    "state.selected_shape_id"(newId) {
      this.selected = this.sdf_scene.findNodeById(newId)
    }
  },

  provide() {
    return {
      draggingId: () => this.draggingId,
      startDrag: this.startDrag,
      validateDrop: this.validateDrop,
      doMove: this.doMove,
      doSelect: this.doSelect
    }
  },

  computed: {
    colorModel: {
      get() {
        if (!this.selected?.material) return "rgba(0,0,0,1)"
        const [r, g, b] = [
          this.selected.material.r,
          this.selected.material.g,
          this.selected.material.b
        ].map((c) => Math.round(c * 255))
        return `rgba(${r},${g},${b},${this.selected.material.a})`
      },
      set(rgba) {
        const parts = rgba
          .replace(/rgba?\(|\)/g, "")
          .split(",")
          .map((s) => s.trim())
        const [r, g, b, a] = parts.map((v, i) =>
          i < 3 ? parseInt(v) / 255 : parseFloat(v)
        )
        if (this.selected?.material) {
          Object.assign(this.selected.material, { r, g, b, a })
        }
      }
    }
  },

  methods: {
    // —— Modifiers & tree ops ——
    onModifierPick(val, i) {
      this.selected.addModifier(val.value)
      this.$nextTick(() => {
        const dd = this.$refs.dropdowns[i]
        dd?.hide?.()
      })
    },

    findById(id, node = this.sdf_scene.root) {
      if (node.id === id) return node
      for (const c of node.children || []) {
        const found = this.findById(id, c)
        if (found) return found
      }
      return null
    },

    isGroupOp(opName) {
      return Object.prototype.hasOwnProperty.call(SD_LIB.BOOLEAN_OPS, opName)
    },

    validateDrop(targetId) {
      const dest = this.findById(targetId)
      return dest && this.isGroupOp(dest.op)
    },

    startDrag(id) {
      this.draggingId = id
    },

    doMove(targetId) {
      const src = this.draggingId
      if (!src || src === targetId) {
        this.draggingId = null
        return
      }
      // find origin + parent
      const findWithParent = (cur, id, parent = null) => {
        if (cur.id === id) return { node: cur, parent }
        for (const c of cur.children || []) {
          const res = findWithParent(c, id, cur)
          if (res) return res
        }
      }
      const origin = findWithParent(this.sdf_scene.root, src)
      const dest = this.findById(targetId)
      if (!origin?.parent || !dest) {
        this.draggingId = null
        return
      }
      const siblings = origin.parent.children
      siblings.splice(
        siblings.findIndex((n) => n.id === src),
        1
      )
      dest.children = dest.children || []
      dest.children.push(origin.node)
      this.draggingId = null
    },

    doSelect(node) {
      this.selected = node
      this.state.selected_shape_id = node.id
    },

    addNode(parentId, opName) {
      const parent = this.findById(parentId)
      if (!parent) return console.warn("Parent not found:", parentId)
      const cfg = this.makeConfigFromLib(opName)
      parent.children = parent.children || []
      parent.addChild(cfg)
    }
  }
}
</script>

<style scoped lang="scss">
/* no extra styles needed */
</style>
