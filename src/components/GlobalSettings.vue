<template>
  <q-dialog v-model="isOpen" persistent dark>
    <q-card class="bg-dark text-white" style="min-width: 400px; max-width: 800px">
      <q-card-section class="text-h6">Global Settings</q-card-section>
      <q-separator dark />
      <q-card-section class="column q-gutter-md">
         <q-item dark>
          <q-item-section side class="text-white">Meshing</q-item-section>
          <q-item-section>
            <q-toggle
          v-model="global_settings.extract.enabled"
          checked-icon="check"
          unchecked-icon="clear"
          dark
          color="primary"
          label="Enabled"
        />
          </q-item-section>
        </q-item>
        <q-item dark>
          <q-item-section side class="text-white">Display Mode</q-item-section>
          <q-item-section>
            <q-select
              v-model="global_settings.display.mode"
              :options="modeOptions"
              emit-value
              
              dense
              
              hide-dropdown-icon
              outlined
              dark
            />
          </q-item-section>
        </q-item>

        <div class="text-subtitle1 text-white">Raymarch Settings</div>
        <q-toggle
          v-model="global_settings.display.raymarch.adaptive_epsilon"
          checked-icon="check"
          unchecked-icon="clear"
          dark
          color="red"
          label="Adaptive Epsilon"
        />
        <q-toggle
          v-model="global_settings.display.disable_animations"
          checked-icon="check"
          unchecked-icon="clear"
          dark
          color="red"
          label="Disable animations"
        />
         <q-toggle
          v-model="global_settings.display.render_only_on_change"
          checked-icon="check"
          unchecked-icon="clear"
          dark
          color="red"
          label="Render only if scene or view changed"
        />
        <q-item dark>
          <q-item-section side class="text-white">Epsilon</q-item-section>
          <q-item-section>
            <q-slider
              v-model="global_settings.display.raymarch.epsilon"
              :min="0.000001"
              :max="2"
              :step="0.000001"
              dense
              dark
              label-always
            />
          </q-item-section>
        </q-item>
        <q-item dark>
          <q-item-section side class="text-white">Max Steps</q-item-section>
          <q-item-section>
            <q-slider
              v-model="global_settings.display.raymarch.max_steps"
              :min="1"
              :max="500"
              :step="1"
              dense
              dark
              label-always
            />
          </q-item-section>
        </q-item>
        <q-item dark>
          <q-item-section side class="text-white">Max Distance</q-item-section>
          <q-item-section>
            <q-slider
              v-model="global_settings.display.raymarch.max_dist"
              :min="10"
              :max="1000"
              :step="10"
              dense
              dark
              label-always
            />
          </q-item-section>
        </q-item>

        <q-separator dark class="bg-grey-7" />
        <div class="text-subtitle1 text-white">General Display</div>
        <q-item dark>
          <q-item-section side class="text-white">HW Scaling</q-item-section>
          <q-item-section>
            <q-slider
              v-model="HW_SCALING"
              :min="0.1"
              :max="1"
              :step="0.01"
              dense
              dark
              label-always
            />
          </q-item-section>
        </q-item>
        <q-toggle
          v-model="global_settings.display.show_world_grid"
          checked-icon="check"
          unchecked-icon="clear"
          dark
          label="Show World Grid"
        />
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat dark label="Close" @click="$emit('update:modelValue', false)" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { DISPLAY_MODES } from "../lib/enums.js"
export default {
  name: "GlobalSettingsDialog",
  inject: ["global_settings"],
  props: {
    modelValue: { type: Boolean, default: false }
  },
  emits: ["update:modelValue"],
  computed: {
    isOpen: {
      get() {
        return this.modelValue
      },
      set(v) {
        this.$emit("update:modelValue", v)
      }
    },
    HW_SCALING: {
      get() {
        return 1 / this.global_settings.display.resolution_multiplier
      },
      set(v) {
        this.global_settings.display.resolution_multiplier = 1 / v
      }
    },
    modeOptions() {
      return     Object.entries(DISPLAY_MODES).map(([label, value]) => ({label, value}))
      
    }
  },
  methods: {
    /**
     * Enable or disable CSS transitions site-wide by toggling
     * the `.notransition` class on <body>.
     *
     * @param {boolean} enabled – if true, transitions are enabled; if false, they're disabled.
     */
    setTransitionsEnabled(enabled) {
      const method = enabled ? "remove" : "add"
      this.window?.document?.body?.classList?.[method]("notransition")
    }
  },
  watch: {
    "global_settings.display.disable_animations": {
      handler(n, o) {
        this.setTransitionsEnabled(!n)
      },
      immediate: true
    }
  }
}
</script>

<style scoped>
:deep(.q-item) {
  background: #303030;
  border-radius: 8px;
}

kdb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  padding: 2px 4px;
  font-family: monospace;
  color: #fff;
}
</style>
