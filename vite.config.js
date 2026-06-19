import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Base path for GitHub Pages: https://<user>.github.io/-/
  base: '/-/',
  plugins: [react()],
})
