import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyConfig = {
  '/api': {
    target: 'https://app.alice.ws',
    changeOrigin: true,
    secure: true,
    rewrite: (path: string) => path.replace(/^\/api/, '/cli/v1'),
  },
}

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  const basePath = process.env.VITE_BASE_PATH ?? (isDev ? '/' : '/alice-eph-front/')

  return {
    base: basePath,
    plugins: [react()],
    server: { proxy: proxyConfig },
    preview: { proxy: proxyConfig },
  }
})
