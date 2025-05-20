<template>
  <div class="q-pa-md">
    <q-select
      ref="picker"
      autofocus
      dense
      text-color="white"
      hide-dropdown-icon
      use-input
      v-model="model"
      :options="options"
      @filter="filterFn"
      @update:model-value="(value) => $emit('set-model', value)"
      style="min-width: 180px"
      placeholder="Select op…"
    >
      <template v-slot:no-option>
        <q-item><q-item-section class="text-grey">No results</q-item-section></q-item>
      </template>
    </q-select>
  </div>
</template>

<script>
import SD_LIB from "src/lib/sd-lib"

export default {
  data() {
    const allOps = []
    for (const [cat, group] of Object.entries(SD_LIB.$categories)) {
      for (const [opName, def] of Object.entries(group)) {
        allOps.push({ label: `${def.title} (${cat})`, value: opName })
      }
    }
    return { model: null, options: allOps, allOps }
  },
  methods: {
    // QSelect filter: lazy match on the label
    filterFn(val, update) {
      update(
        () => {
          if (!val) {
            this.options = this.allOps // no-op: show all
          } else {
            const needle = val.toLowerCase()
            this.options = this.allOps.filter(
              (o) =>
                o.label.toLowerCase().includes(needle) ||
                o.value.toLowerCase().includes(needle)
            )
          }
        },
        (ref) => {
          if (val !== "" && ref.options.length > 0) {
            ref.setOptionIndex(-1) // reset optionIndex in case there is something selected
            ref.moveOptionSelection(1, true) // focus the first selectable option and do not update the input-value
          }
        }
      )
    }
  }
}
</script>

<style lang="scss" scoped></style>
