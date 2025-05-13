<template>
    <div v-if="node">
        <div class="tree-node" :class="{ 'drag-over': dragOver, 'node-delete-dropdown': true }" draggable="true"
            @dragstart="handleDragStart" @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop"
            @click.stop="handleSelect" style="pointer-events:auto; display:flex; align-items:center;">
            <q-menu touch-position context-menu>

                <q-list dense style="min-width: 100px">
                    <q-item @click="clone" clickable v-close-popup>
                        <q-item-section>Duplicate</q-item-section>
                    </q-item>
                    <q-item
                        @click="copyValueToClipboard(JSON.stringify(node.serialize(true), null, '  '), 'Copied JSON literal to clipboard')"
                        clickable v-close-popup>
                        <q-item-section>Copy scene tree at node</q-item-section>
                    </q-item>
                    <q-item @click="copyValueToClipboard(getCompiledWgsl(), 'Copied JSON literal to clipboard')"
                        clickable v-close-popup>
                        <q-item-section>[STACK] copy WGSL distance-to-scene function at node</q-item-section>
                    </q-item>
                    <q-item @click="copyValueToClipboard(node.toWGSL(), 'Copied JSON literal to clipboard')" clickable
                        v-close-popup>
                        <q-item-section>Copy WGSL distance-to-scene function at node</q-item-section>
                    </q-item>
                    <q-item @click="copyValueToClipboard(node.toGLSL(), 'Copied JSON literal to clipboard')" clickable
                        v-close-popup>
                        <q-item-section>Copy GLSL distance-to-scene function at node</q-item-section>
                    </q-item>
                </q-list>

            </q-menu>
            <q-chip dark class="tree-node-chip q-pa-none" square dense
                :icon="node.children?.length ? 'mdi-folder-outline' : 'mdi-cube-outline'" color="transparent"
                :text-color="isSelected ? 'yellow' : undefined">
                <q-badge v-if="node.material" rounded :style="{
                    background: matToRbga(node.material),
                    marginRight: '4px'
                }" />

                {{ node.name || node.op }}
            </q-chip>

            <!-- Add-child dropdown, only for group nodes -->
            <q-btn-dropdown text-color="white" v-if="validateDrop(node.id)" dense dropdown-icon="none" size="sm" flat
                unelevated style="pointer-events:auto;">
                <template v-slot:label>
                    <q-icon name="mdi-plus"></q-icon>
                </template>
                <LibraryPicker @set-model="setModel" />
            </q-btn-dropdown>
            <!-- delete button on non-root nodes -->
            <q-btn text-color="white" size="xs" v-if="node.parent" dense flat round icon="mdi-content-duplicate"
                @click.stop="clone" style="pointer-events:auto;" />
            <!-- delete button on non-root nodes -->
            <q-btn text-color="white" size="xs" v-if="node.parent" dense flat round icon="mdi-delete-outline"
                @click.stop="onDelete" style="pointer-events:auto;" />
        </div>

        <div class="children">
            <TreeNode v-for="child in node.children || []" :key="child.id" :node="child" :selected="selected" />
        </div>
    </div>
</template>

<script>
import SD_LIB from "src/lib/sd-lib"
import LibraryPicker from "./LibraryPicker.vue"
import { copyToClipboard } from "quasar"
import { generateWGSL } from "src/lib/sd-scene-shader-representation"

export default {
    name: "TreeNode",
    components: { LibraryPicker },
    props: {
        node: { type: Object, required: true },
        selected: { type: Object, default: null }
    },
    inject: [
        "draggingId",
        "startDrag",
        "validateDrop",
        "doMove",
        "sdf_scene",
        "adapter",
        "doSelect",
        "state"
    ],
    data() {
        // flatten all SD_LIB ops for the select dropdown

        return {
            dragOver: false,
            model: null,
        }
    },
    computed: {
        isSelected() {
            return this.selected?.id === this.node?.id || this.state.selected_shape_id === this.node?.id
        }
    },
    mounted() {

    },
    methods: {
        getCompiledWgsl() {
            return generateWGSL(this.node.scene, { compile_static: true })?.code
        },
        copyValueToClipboard(key, msg = "Value path copied to clipboard!") {
            copyToClipboard(key)
                .then(() => {
                    this.$q.notify({
                        message: msg
                    })
                })
                .catch(() => { })
        },
        matToRbga(m) {
            if (!m) return "rgba(0,0,0,1)"
            const [r, g, b] = [m.r, m.g, m.b].map(c => Math.round(c * 255))
            return `rgba(${r},${g},${b},${m.a})`
        },
        handleDragStart(e) {
            this.startDrag(this.node.id)
            e.dataTransfer.effectAllowed = "move"
            e.dataTransfer.setData("text/plain", this.node.id)
        },
        handleDragOver(e) {
            if (this.validateDrop(this.node.id)) {
                e.preventDefault()
                this.dragOver = true
            }
        },
        handleDragLeave() {
            this.dragOver = false
        },
        handleDrop(e) {
            e.preventDefault()
            this.dragOver = false
            this.doMove(this.node.id)
        },
        handleSelect() {
            this.doSelect(this.node)
        },


        setModel(val) {
            if (val) {
                this.sdf_scene.addNode(this.node.id, val.value)
                this.model = null
            }
        },

        clone(val) {
            this.sdf_scene.duplicateNode(this.node.id, true)
        },

        onDelete() {
            this.sdf_scene.removeNodeById(this.node.id)
        },

    },

}
</script>

<style lang="scss" scoped></style>