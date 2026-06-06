import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Silencia erros esperados nos logs (ErrorBoundary, ClubContext, etc.)
    onConsoleLog: (log: string) => {
      if (log.includes('Test explosion')) return false
      if (log.includes('useClub must be used')) return false
      if (log.includes('Failed to load games')) return false
      return true
    },
  },
})