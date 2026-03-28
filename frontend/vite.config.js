import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('docx')) return 'vendor-export'
          if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n'
          if (id.includes('@dnd-kit')) return 'vendor-dnd'
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/') || id.includes('/node_modules/scheduler/')) return 'vendor-react'
          if (id.includes('axios')) return 'vendor-network'
          if (id.includes('xlsx')) return 'vendor-xlsx'
          return 'vendor'
        },
      },
    },
  },
})
