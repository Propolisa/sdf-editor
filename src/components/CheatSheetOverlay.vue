<template>
    <q-dialog v-model="isOpen" persistent dark>
        <q-card class="bg-dark text-white" style="min-width: 400px; max-width: 800px;">
            <q-card-section class="text-h6">Controls Cheat Sheet</q-card-section>
            <q-separator dark />
            <q-card-section>
                <div><strong>General</strong></div>
                <ul>
                    <li><kbd>Esc</kbd>: Cancel transform</li>
                    <li><kbd>Ctrl+Alt+I</kbd>: Toggle inspector</li>
                    <li><kbd>Shift+D</kbd>: Duplicate selection</li>
                </ul>
                <div><strong>Transforms</strong></div>
                <ul>
                    <li><kbd>G</kbd>: Grab (Translate)</li>
                    <li><kbd>R</kbd>: Rotate</li>
                    <li><kbd>S</kbd>: Scale</li>
                    <li>Then:</li>
                    <ul>
                        <li><kbd>X</kbd>/<kbd>Y</kbd>/<kbd>Z</kbd>: Axis constrain</li>
                        <li>Type <kbd>0–9</kbd>/<kbd>.</kbd>: Numeric input</li>
                        <li><kbd>Backspace</kbd>: Remove digit</li>
                    </ul>
                </ul>
                <div><strong>Viewport Navigation</strong></div>
                <ul>
                    <li><kbd>1</kbd>: Front (<kbd>Ctrl+1</kbd>: Back)</li>
                    <li><kbd>3</kbd>: Left (<kbd>Ctrl+3</kbd>: Right)</li>
                    <li><kbd>7</kbd>: Top (<kbd>Ctrl+7</kbd>: Bottom)</li>
                    <li><kbd>5</kbd>: Toggle orthographic</li>
                    <li><kbd>0</kbd>: Camera view (<kbd>Ctrl+Alt+0</kbd>: Reset)</li>
                    <li><kbd>2/4/6/8</kbd>: Rotate/Pan view</li>
                    <li><kbd>.</kbd>: Zoom to selection</li>
                </ul>
                <div><strong>Ortho Zoom</strong>: Scroll wheel + inertia</div>
            </q-card-section>
            <q-card-actions align="right">
                <q-btn flat dark label="Close" @click="$emit('update:modelValue', false)" />
            </q-card-actions>
        </q-card>
    </q-dialog>
</template>

<script>
export default {
    name: 'CheatSheetOverlay',
    props: {
        modelValue: { type: Boolean, default: false }
    },
    emits: ['update:modelValue'],
    computed: {
        isOpen: {
            get() { return this.modelValue },
            set(v) { this.$emit('update:modelValue', v) }
        }
    }
}
</script>

<style scoped>
kbd {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    padding: 2px 4px;
    font-family: monospace;
    color: #fff;
}
</style>