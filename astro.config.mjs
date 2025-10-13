import { defineConfig } from 'astro/config'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  vite: { plugins: [basicSsl()] }
})
