import { defineStore, acceptHMRUpdate } from 'pinia'
import { BLOBBY, DEFAULT, FISH } from 'src/lib/scenes'
import localforage from 'localforage'

export const useScenesStore = defineStore('scenes', {
  state: () => ({
    // Each scene holds its serialized JSON plus a history of revisions
    scenes: {
      BLOBBY: {
        current: JSON.stringify(BLOBBY),
        revisions: [],
      },
      FISH: {
        current: JSON.stringify(FISH),
        revisions: [],
      },
      DEFAULT: {
        current: JSON.stringify(DEFAULT),
        revisions: [],
      },
    },
    // The key of the active scene
    activeScene: 'DEFAULT',
  }),

  getters: {
    // Parsed data for the active scene
    activeSceneData(state) {
      const entry = state.scenes[state.activeScene]
      return entry ? JSON.parse(entry.current) : null
    },
    // Retrieve revision list for any scene (parsed)
    getRevisions: (state) => (name) => {
      const entry = state.scenes[name]
      return entry ? entry.revisions.map((json) => JSON.parse(json)) : []
    },
  },

  actions: {
    /**
     * Update a scene's JSON.
     * @param {string} name       The scene key (e.g. 'BLOBBY')
     * @param {string} jsonString The new serialized scene JSON
     * @param {boolean} revision  If true, push the old version into revisions; else clear history
     */
    updateScene(name, jsonString, revision = false) {
      if (!this.scenes[name]) {
        // If scene doesn't exist, create it
        this.scenes[name] = { current: jsonString, revisions: [] }
      } else {
        if (revision) {
          // snapshot: keep previous in history
          this.scenes[name].revisions.push(this.scenes[name].current)
        } else {
          // full overwrite: drop past history
          this.scenes[name].revisions = []
        }
        this.scenes[name].current = jsonString
      }
    },

    /**
     * Change which scene is active
     */
    setActiveScene(name) {
      if (!this.scenes[name]) {
        throw new Error(`Scene "${name}" does not exist.`)
      }
      this.activeScene = name
    },

    /**
     * Revert a scene to one of its past revisions
     * @param {string} name  Scene key
     * @param {number} idx   Index in the revisions array
     */
    revertToRevision(name, idx) {
      const entry = this.scenes[name]
      if (!entry) throw new Error(`Scene "${name}" not found.`)
      if (idx < 0 || idx >= entry.revisions.length) {
        throw new Error(`Invalid revision index ${idx}.`)
      }
      // push current state into history
      entry.revisions.push(entry.current)
      // restore requested revision
      entry.current = entry.revisions[idx]
    },
  },

  // Persist store to localStorage
  persist: {
    enabled: true,
    storage: {
      getItem: (key) => localforage.getItem(key),
      setItem: (key, value) => localforage.setItem(key, value),
      removeItem: (key) => localforage.removeItem(key),
    },
  },
})

// Hot Module Replacement support
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useScenesStore, import.meta.hot))
}
