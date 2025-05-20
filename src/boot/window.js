import { defineBoot } from '#q-app/wrappers'

export default defineBoot(({ app }) => {
 app.config.globalProperties.window = window
})
