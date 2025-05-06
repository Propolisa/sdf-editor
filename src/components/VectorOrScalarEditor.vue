<template>
  <div class="vector-editor bg-grey-9 q-pa-sm">
    <!-- Render one <q-input> per value (array or single) -->
    <q-input input-class="vose-text-input-centered" v-for="(num, i) in internalValues" :key="i" dense dark outlined
      class="vector-cell" :model-value="num" @update:model-value="val => updateValue(i, val)"
      @wheel.prevent="onWheel(i, $event)" :class="{
        'rounded-left': i === 0,
        'rounded-right': i === internalValues.length - 1
      }" />

    <!-- Add/remove only for array mode -->
    <!-- <div v-if="isArray" class="row items-center q-ml-sm">
      <q-btn dense flat round icon="add" @click="addElement" />
      <q-btn dense flat round icon="remove" @click="removeElement" />
    </div> -->
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [Number, Array],
    required: true
  }
})
const emit = defineEmits(['update:modelValue'])

// Are we editing an array (vector) or a single scalar?
const isArray = computed(() => Array.isArray(props.modelValue))
// Normalize to an array for rendering; scalar becomes [value]
const internalValues = computed(() =>
  isArray.value ? props.modelValue : [props.modelValue]
)

// Central setter: mutates arrays in place via splice, or emits new scalar
function setValue(index, raw) {
  const n = parseFloat(raw)
  const val = isNaN(n) ? 0 : n

  if (isArray.value) {
    // In-place mutation for reactivity
    props.modelValue.splice(index, 1, val)
    emit('update:modelValue', props.modelValue)
  }
  else {
    emit('update:modelValue', val)
  }
}

// Called from @update:model-value on each <q-input>
function updateValue(index, value) {
  setValue(index, value)
}

// Array controls
function addElement() {
  props.modelValue.splice(props.modelValue.length, 0, 0)
  emit('update:modelValue', props.modelValue)
}
function removeElement() {
  if (props.modelValue.length > 0) {
    props.modelValue.splice(props.modelValue.length - 1, 1)
    emit('update:modelValue', props.modelValue)
  }
}

// Wheel-to-step handler
function onWheel(index, e) {
  const dir = e.deltaY < 0 ? 1 : -1
  let step = 1
  if (e.shiftKey) step *= 0.25
  if (e.ctrlKey) step *= 4

  const current = Number(internalValues.value[index]) || 0
  setValue(index, current + dir * step)
}
</script>

<style>
.vector-editor {
  display: flex;
  align-items: center;
}

/* match your old 60px width + overlap */
.vector-cell {
  padding: 0
    /* width: 60px; */
    /* margin-right: -1px; */
}

/* pill-shape on the outermost cells */
.rounded-left {
  border-top-left-radius: 1.5rem !important;
  border-bottom-left-radius: 1.5rem !important;
}

.rounded-right {
  border-top-right-radius: 1.5rem !important;
  border-bottom-right-radius: 1.5rem !important;
}

.q-field__control.relative-position.row.no-wrap {
  padding: 2px;
}

.vose-text-input-centered {
  text-align: center;
}
</style>
