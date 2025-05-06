<template>
    <div class="q-pa-md" style="position:fixed; max-width: 350px">
        <q-btn-dropdown class="bg-primary text-white" v-if="!show_global_settings" color="white" fab-mini flat
            dropdown-icon="mdi-cog" @click="toggleGlobalSettings"></q-btn-dropdown>
        <div :style="show_global_settings ? '' : 'visibility:hidden;'">
            <q-expansion-item expand-icon-toggle v-model="show_global_settings" dense class="shadow-1 overflow-hidden"
                style="border-radius: 12px" icon="mdi-cog" @show="startCounting" @hide="stopCounting"
                header-class="bg-primary text-white" hide-expand-icon>
                <template v-slot:header><q-btn-dropdown color="white" fab-mini flat dropdown-icon="mdi-cog"
                        @click="toggleGlobalSettings"></q-btn-dropdown></template>
                <q-card>
                    <q-card-section>
                        <q-toggle v-model="global_settings.display.raymarch.adaptive_epsilon" checked-icon="check"
                            color="red" label="Adaptive epsilon " unchecked-icon="clear" />
                        <q-field label="Epsilon"><template v-slot:control><q-slider
                                    v-model="global_settings.display.raymarch.epsilon" :min=".000001" :max="2"
                                    :step=".000001" label color="light-green" /></template></q-field>
                        <q-slider v-model="global_settings.display.resolution_multiplier" :min=".5" :max="4" :step=".2"
                            label color="light-green" />
                    </q-card-section>
                </q-card>
            </q-expansion-item>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return { show_global_settings: true }
    },
    methods: {
        toggleGlobalSettings() {
            this.show_global_settings = !this.show_global_settings
        },
        startCounting() {

        },
        stopCounting() {

        }
    },
    inject: ["global_settings"]

}
</script>

<style lang="scss" scoped></style>