<template>
  <q-select
    filled
    v-model="selectedScene"
    clearable
    use-input
    hide-selected
    fill-input
    input-debounce="0"
    label="Select a scene"
    :options="options"
    @filter="filterFnAutoselect"
    @filter-abort="abortFilterFn"
    style="width: 250px"
  >
    <template v-slot:no-option>
      <q-item>
        <q-item-section class="text-grey"> No results </q-item-section>
      </q-item>
    </template>
  </q-select>
</template>

<script>
import { useScenesStore } from "src/stores/scenes"

const store = useScenesStore()

export default {
  name: "SceneSelector",

  data() {
    return {
      options: []
    }
  },

  computed: {
    // full list of options derived from the store
    allOptions() {
      return Object.keys(store.scenes).map((id) => ({
        label: id,
        value: id
      }))
    },
    // bind v-model to store.activeScene
    selectedScene: {
      get() {
        return store.activeScene || null
      },
      set(val) {
        store.activeScene = val.value
      }
    }
  },

  created() {
    // initialize the options array
    this.options = this.allOptions
  },

  methods: {
    // autoselect-first filter
    filterFnAutoselect(val, update, abort) {
      update(
        () => {
          this.options =
            val === ""
              ? this.allOptions
              : this.allOptions.filter((opt) =>
                  opt.label.toLowerCase().includes(val.toLowerCase())
                )
        },
        (select) => {
          if (val !== "" && select.options.length > 0 && select.getOptionIndex() === -1) {
            // focus and select the first match
            select.moveOptionSelection(1, true)
            select.toggleOption(select.options[select.getOptionIndex()], true)
          }
        }
      )
    },

    // no-op for aborted filters
    abortFilterFn() {}
  }
}
</script>

<style scoped>
/* add custom styles here if needed */
</style>
