<template>
    <div>
        <div class="tree-node" :class="{ 'drag-over': dragOver }" draggable="true" @dragstart="handleDragStart"
            @dragover="handleDragOver" @dragleave="handleDragLeave" @drop="handleDrop" @click.stop="handleSelect"
            style="pointer-events:auto; display:flex; align-items:center;">
            <q-chip dark class="bg-transparent" square dense
                :icon="node.children?.length ? 'mdi-folder-outline' : 'mdi-cube-outline'"
                :color="selected === node ? 'primary' : undefined" text-color="white">
                <q-badge v-if="node.material" rounded
                    :style="'background: ' + matToRbga(node.material) + '; margin-right:4px;'" />
                {{ node.name || node.op }}
            </q-chip>

            <!-- Add-child dropdown, only for group nodes -->
            <q-btn-dropdown text-color="white" v-if="validateDrop(node.id)" dense flat round dropdown-icon="mdi-plus"
                style="pointer-events:auto;">
                <div class="q-pa-md">
                    <q-select dense text-color="white" hide-dropdown-icon use-input fill-input input-debounce="0"
                        v-model="addModel" :options="options" @filter="filterFn" @update:model-value="setModel"
                        style="min-width: 180px" placeholder="Select op…">
                        <template v-slot:no-option>
                            <q-item><q-item-section class="text-grey">No results</q-item-section></q-item>
                        </template>
                    </q-select>
                </div>
            </q-btn-dropdown>

            <!-- delete button on non-root nodes -->
            <q-btn text-color="white" size="sm" v-if="node.parent" dense flat round icon="mdi-delete-outline"
                class="q-ml-sm" @click.stop="onDelete" style="pointer-events:auto;" />
        </div>

        <div class="children">
            <TreeNode v-for="child in node.children || []" :key="child.id" :node="child" :selected="selected" />
        </div>
    </div>
</template>

<script>
import SD_LIB from "src/lib/sd-lib"


export default {
    name: "TreeNode",
    props: {
        node: { type: Object, required: true },
        selected: { type: Object, default: null }
    },
    inject: [
        "draggingId",
        "startDrag",
        "validateDrop",
        "doMove",
        "doSelect",
        "addNode",
        "removeNode"
    ],
    data() {
        // flatten all SD_LIB ops for the select dropdown
        const allOps = []
        for (const [cat, group] of Object.entries(SD_LIB)) {
            for (const [opName, def] of Object.entries(group)) {
                allOps.push({ label: `${def.title} (${cat})`, value: opName })
            }
        }
        return {
            dragOver: false,
            addModel: null,
            options: allOps
        }
    },
    mounted(){
        debugger
    },
    methods: {
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

        // QSelect filter: lazy match on the label
        filterFn(val, update) {
            update(() => {
                if (!val) {
                    this.options = this.options // no-op: show all
                } else {
                    const needle = val.toLowerCase()
                    this.options = this.options.filter(o =>
                        o.label.toLowerCase().includes(needle)
                    )
                }
            })
        },

        // called when user picks an op
        setModel(val) {

            if (val) {
                this.addNode(this.node.id, val.value)
                this.addModel = null
            }
        },

        onDelete() {
            this.removeNode(this.node.id)
        }
    },
    
}
</script>

<style lang="scss" scoped></style>