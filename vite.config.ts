import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // Relative base so built asset URLs work regardless of the repo name
  // GitHub Pages serves this from (https://<user>.github.io/<repo>/).
  base: './',
})
