<template>
  <div class="matrix-editor q-pa-sm bg-grey-9">
    <!-- Matrix layout when we have a parsed columns count -->
    <template v-if="isArray && cols > 1">
      <div class="matrix-row row no-wrap items-center q-mb-xs" v-for="(row, r) in rows" :key="r">
        <q-input v-for="(num, c) in row" :key="`r${r}c${c}`" dense dark outlined class="vector-cell"
          input-class="vose-text-input-centered" :model-value="num"
          @update:model-value="val => updateValue(r * cols + c, val)" @wheel.prevent="onWheel(r * cols + c, $event)"
          :class="cellClasses(r, c, row.length)" />
      </div>
    </template>

    <!-- Fallback: single row -->
    <template v-else>
      <div class="matrix-row row no-wrap items-center">
        <q-input v-for="(num, i) in internalValues" :key="i" dense dark outlined class="vector-cell"
          input-class="vose-text-input-centered" :model-value="num" @update:model-value="val => updateValue(i, val)"
          @wheel.prevent="onWheel(i, $event)" :class="cellClasses(0, i, internalValues.length)" />
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [Number, Array],
    required: true
  },
  /**
   * A WGSL matrix type, in short form (`matCxR<dtype>`)
   * or long form (`matrix<dtype, C, R>`).
   * E.g. "mat3x2<f32>" or "matrix<f32, 3, 2>".
   */
  wgslType: {
    type: String,
    default: ''
  }
})
const emit = defineEmits(['update:modelValue'])

// Normalize modelValue to an array
const internalValues = computed(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue]
)
const isArray = computed(() => Array.isArray(props.modelValue))

// Parse wgslType for columns & rows
const matrixDims = computed(() => {
  const s = props.wgslType.trim()
  let m

  // Short form: matCxR<...>
  m = /^mat(\d+)x(\d+)<.*>$/.exec(s)
  if (m) {
    return { cols: parseInt(m[1], 10), rows: parseInt(m[2], 10) }
  }

  // Long form: matrix<dtype, C, R>
  m = /^matrix<[^,]+,\s*(\d+),\s*(\d+)>$/.exec(s)
  if (m) {
    return { cols: parseInt(m[1], 10), rows: parseInt(m[2], 10) }
  }

  return null
})

// Number of columns to use in layout (0 means single row)
const cols = computed(() =>
  matrixDims.value && isArray.value && matrixDims.value.cols > 1
    ? matrixDims.value.cols
    : 0
)

// Break the flat array into rows of length `cols`
const rows = computed(() => {
  if (!cols.value) return []
  const out = []
  const flat = internalValues.value
  for (let i = 0; i < flat.length; i += cols.value) {
    out.push(flat.slice(i, i + cols.value))
  }
  return out
})

// Rounding classes for first & last cell only
function cellClasses(rowIndex, colIndex, rowLength) {
  const isFirst = rowIndex === 0 && colIndex === 0
  const isLast =
    (cols.value
      ? rowIndex === rows.value.length - 1 && colIndex === rowLength - 1
      : rowIndex === 0 && colIndex === rowLength - 1)
  return {
    'rounded-left': isFirst,
    'rounded-right': isLast
  }
}

// Central setter
function setValue(index, raw) {
  const n = parseFloat(raw)
  const val = isNaN(n) ? 0 : n

  if (isArray.value) {
    props.modelValue.splice(index, 1, val)
    emit('update:modelValue', props.modelValue)
  } else {
    emit('update:modelValue', val)
  }
}

function updateValue(index, value) {
  setValue(index, value)
}

function onWheel(index, e) {
  const dir = e.deltaY < 0 ? 1 : -1
  let step = 1
  if (e.shiftKey) step *= 0.25
  if (e.ctrlKey) step *= 4

  const curr = Number(internalValues.value[index]) || 0
  setValue(index, curr + dir * step)
}
</script>

<style>
.matrix-editor {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.matrix-row {
  display: flex;
}

.vector-cell {
  padding: 0;
}

.rounded-left {
  border-top-left-radius: 1.5rem !important;
  border-bottom-left-radius: 1.5rem !important;
}

.rounded-right {
  border-top-right-radius: 1.5rem !important;
  border-bottom-right-radius: 1.5rem !important;
}

.vose-text-input-centered {
  text-align: center;
}
</style>
