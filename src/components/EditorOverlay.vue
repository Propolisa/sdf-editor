<template>
    <q-splitter v-if="sdf_scene" after-class="se_panel_root" class="fit" v-model="splitWidth">
        <template #after>
            <q-splitter before-class="se_panel" after-class="se_panel" id="splitter_view" v-model="splitPanelHeight"
                horizontal :limits="[20, 80]">
                <template #before>
                    <q-scroll-area class="scene-tree" style="height:100%">
                        <TreeNode :node="sceneData" :selected="selected" />
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
                                    <q-input dense dark v-model="selected.name" label="Name" />
                                    <q-input dense dark v-model="selected.op" label="Op" />

                                    <div v-for="(val, key) in selected.args" :key="key" class="q-mb-sm">
                                        <!-- Array case: inline vector editor -->
                                        <template v-if="Array.isArray(val)">
                                            <div class="text-white text-caption q-mb-xs">{{ key }}</div>
                                            <div class="row no-wrap inline-vector" style="align-items:center;">
                                                <q-input v-for="(num, idx) in val" :key="idx" dense dark outlined
                                                    type="number" v-model.number="selected.args[key][idx]"
                                                    :class="{ first: idx === 0, last: idx === val.length - 1 }"
                                                    style="width: 60px; margin-right: -1px;" />
                                            </div>
                                        </template>

                                        <!-- Scalar case -->
                                        <template v-else>
                                            <q-input dense dark v-model.number="selected.args[key]" :label="key"
                                                type="number" />
                                        </template>
                                    </div>
                                </q-form>


                            </q-tab-panel>

                            <q-tab-panel name="material">

                                <div v-if="selected?.material">
                                    <q-color dense dark v-model="colorModel" format-model="rgba" flat />
                                </div>
                                <div v-else>No material</div>

                            </q-tab-panel>

                            <q-tab-panel name="modifiers">
                                <div v-if="selected?.modifiers">
                                    <div v-for="(m, i) in selected.modifiers" :key="i">
                                        <q-input dense dark v-model="m.op" label="Op" />
                                        <div v-for="(val, key) in m.args" :key="key">
                                            <q-input dense dark v-model.number="m.args[key]" :label="key"
                                                type="number" />
                                        </div>
                                    </div>
                                </div>
                                <div v-else>No modifiers</div>
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
export default {
    name: "EditorOverlay",
    components: { TreeNode },
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
            doSelect: this.doSelect,
            addNode: (parentId, opName) => this.addNode(parentId, opName),
            removeNode: id => this.removeNode(id)
        }
    },
    inject: ['sdf_scene', 'adapter'],
    mounted() {
        debugger
    },
    computed: {
        sceneData() { return this.sdf_scene },
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
            return recurse(this.sceneData)
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
            const origin = findWithParent(this.sceneData, srcId)
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
        },


        //
        // —— NEW: Add / Remove helpers —— 
        //

        // build a blank config from SD_LIB
        makeConfigFromLib(opName) {
            let def = null
            for (const cat of Object.values(SD_LIB)) {
                if (cat[opName]) {
                    def = cat[opName]
                    break
                }
            }
            if (!def) {
                throw new Error(`Unknown SD_LIB op "${opName}"`)
            }
            const args = {}
            for (const [k, type] of Object.entries(def.args)) {
                if (k === "p") continue
                if (type === "f32") {
                    args[k] = 0
                } else {
                    const m = type.match(/^vec(\d+)f$/)
                    args[k] = m ? Array(parseInt(m[1], 10)).fill(0) : 0
                }
            }
            return {
                op: opName, args, material: { r: 5.0, g: 1.0, b: 0.0, a: 1.0 }, modifiers: [
                    { op: 'opTranslate', args: { t: [2.3, 3, -15.0] } }
                ], children: []
            }
        },

        // add a new child under parentId
        addNode(parentId, opName) {

            const parent = this.findById(parentId)
            if (!parent) {
                console.warn("Parent not found:", parentId)
                return
            }
            const cfg = this.makeConfigFromLib(opName)
            debugger
            parent.children = parent.children || []
            parent.addChild(cfg)
            this.adapter.sync()
        },

        // remove this node (and its subtree)
        removeNode(nodeId) {
            const node = this.findById(nodeId)
            if (!node || !node.parent) {
                console.warn("Cannot remove root or missing node:", nodeId)
                return
            }
            const siblings = node.parent.children
            node.parent.children = siblings.filter(c => c !== node)
        }
    }
}
</script>

<style lang="scss" scoped></style>