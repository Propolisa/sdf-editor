<template>
    <q-splitter before-class="sdfe-do-not-overflow" after-class="se_panel_root" class="absolute-full"
        v-model="splitWidth">
        <template #before>
            <GlobalSettings></GlobalSettings>
            <slot></slot>
        </template>
        <template #after v-if="sdf_scene">
            <q-splitter before-class="se_panel" after-class="se_panel" id="splitter_view" v-model="splitPanelHeight"
                horizontal :limits="[20, 80]">
                <template #before>
                    <q-scroll-area class="scene-tree" style="height:100%">
                        <TreeNode :node="sdf_scene.root" :selected="selected" />
                    </q-scroll-area>
                </template>

                <template #after>
                    <div class="prop-container" style="height:100%">
                        <q-tabs dark vertical dense class="icon-tabs" v-model="activeTab">
                            <q-tab name="object" icon="mdi-cube-outline" />
                            <q-tab name="material" icon="mdi-palette-outline" />
                            <q-tab name="modifiers" icon="mdi-cog-outline" />
                        </q-tabs>

                        <q-tab-panels dark vertical class="bg-transparent tab-content" v-model="activeTab">
                            <q-tab-panel name="object">
                                <q-form dense dark v-if="selected">
                                    <!-- Basic fields -->
                                    <q-input dense dark v-model="selected.name" label="Name" class="q-mb-sm" />
                                    <q-input dense dark v-model="selected.op" label="Op" class="q-mb-sm" />

                                    <!-- args: inline label + editor via q-field -->
                                    <div class="row wrap">
                                        <q-field v-for="(val, key) in selected.args" :key="key" :label="key"
                                            label-always dense class="q-mr-md q-mb-sm"
                                            label-class="text-caption text-white">
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
                                <q-btn-dropdown text-color="white" dense dropdown-icon="none" size="sm" flat unelevated
                                    style="pointer-events:auto;">
                                    <template v-slot:label>
                                        <q-icon name="mdi-plus"></q-icon>
                                    </template>
                                    <LibraryPicker @set-model="addModifier" />
                                </q-btn-dropdown>
                                <template v-if="selected?.modifiers?.length">
                                    <div v-for="(m, i) in selected.modifiers" :key="i"
                                        class="modifier-item q-mb-md q-pa-sm bg-grey-8 rounded">
                                        <!-- Op field -->
                                        <q-input dense dark filled v-model="m.op" label="Op" class="q-mb-sm" />

                                        <!-- args: inline label + editor -->
                                        <div class="row wrap">
                                            <div v-for="(val, key) in m.args" :key="key"
                                                class="row items-center q-mr-md q-mb-sm">
                                                <div class="text-caption text-white q-mr-sm">
                                                    {{ key }}
                                                </div>
                                                <vector-or-scalar-editor v-model="m.args[key]"
                                                    :wgslType="m.def.args[key]" />
                                            </div>
                                        </div>
                                    </div>
                                </template>
                                <template v-else>
                                    No modifiers
                                </template>
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
import TreeNode from "./TreeNode.vue"
import LibraryPicker from "./LibraryPicker.vue"
import VectorOrScalarEditor from "./VectorOrScalarEditor.vue"
import GlobalSettings from "./GlobalSettings.vue"
export default {
    name: "EditorOverlay",
    components: { TreeNode, VectorOrScalarEditor, GlobalSettings, LibraryPicker },
    watch: {
        "state.selected_shape_id": {
            handler(newVal, oldVal) {
                this.selected = this.sdf_scene.findNodeById(newVal)
            }
        }
    },
    data() {
        return {
            selected: null,
            activeTab: "object",
            splitWidth: 70,
            splitPanelHeight: 50,
            draggingId: null
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
    inject: ['sdf_scene', 'adapter', 'state'],

    computed: {
        colorModel: {
            get() {
                return this.matToRbga(this.selected?.material)
            },
            set(rgba) {
                const parts = rgba
                    .replace(/rgba?\(|\)/g, "")
                    .split(",")
                    .map(s => s.trim())
                const [r, g, b, a] = parts.map((v, i) =>
                    i < 3 ? parseInt(v, 10) / 255 : parseFloat(v)
                )
                if (this.selected?.material) {
                    Object.assign(this.selected.material, { r, g, b, a })
                }
            }
        }
    },
    methods: {
        addModifier(val) {
            this.selected.addModifier(val.value)
        },
        // find node by id
        findById(id) {
            const recurse = n => {
                if (n.id === id) return n
                for (const c of n.children || []) {
                    const f = recurse(c)
                    if (f) return f
                }
                return null
            }
            return recurse(this.sdf_scene.root)
        },

        // only Boolean ops are valid “groups”
        isGroupOp(opName) {
            return Object.prototype.hasOwnProperty.call(
                SD_LIB.BOOLEAN_OPS,
                opName
            )
        },

        // drag/drop validator
        validateDrop(targetId) {
            const dest = this.findById(targetId)
            return dest && this.isGroupOp(dest.op)
        },

        matToRbga(m) {
            if (!m) return "rgba(0,0,0,1)"
            const [r, g, b] = [m.r, m.g, m.b].map(c => Math.round(c * 255))
            return `rgba(${r},${g},${b},${m.a})`
        },
        startDrag(id) {
            this.draggingId = id
        },

        doMove(targetId) {
            const srcId = this.draggingId
            if (!srcId || srcId === targetId) {
                this.draggingId = null
                return
            }
            // find node + parent
            const findWithParent = (cur, id, parent = null) => {
                if (cur.id === id) return { node: cur, parent }
                for (const c of cur.children || []) {
                    const res = findWithParent(c, id, cur)
                    if (res) return res
                }
            }
            const origin = findWithParent(this.sdf_scene.root, srcId)
            const dest = this.findById(targetId)
            if (!origin?.parent || !dest) {
                this.draggingId = null
                return
            }
            const sibs = origin.parent.children
            sibs.splice(sibs.findIndex(n => n.id === srcId), 1)
            dest.children = dest.children || []
            dest.children.push(origin.node)
            this.draggingId = null
        },

        doSelect(node) {
            this.selected = node
            this.state.selected_shape_id = node.id
        },





        // add a new child under parentId
        addNode(parentId, opName) {

            const parent = this.findById(parentId)
            if (!parent) {
                console.warn("Parent not found:", parentId)
                return
            }
            const cfg = this.makeConfigFromLib(opName)
            // debugger
            parent.children = parent.children || []
            parent.addChild(cfg)
            // this.adapter.sync()
        },


    }
}
</script>

<style lang="scss" scoped></style>