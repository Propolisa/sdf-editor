// src/composables/useIntervalFn.js
import { onMounted, onUnmounted } from 'vue'

/**
 * Runs `cb()` every `ms` milliseconds.
 * @param {Function} cb
 * @param {number} ms
 * @param {boolean} immediate – whether to invoke cb() once on mount
 */
export function useIntervalFn(cb, ms, immediate = true) {
  let timerId
  onMounted(() => {
    if (immediate) cb()
    timerId = setInterval(cb, ms)
  })
  onUnmounted(() => {
    clearInterval(timerId)
  })
}