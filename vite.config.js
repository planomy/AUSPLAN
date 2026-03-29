import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so `dist/index.html` works from subfolders, file open, or simple static hosts
  base: './',
  server: {
    // Open the app in your default browser when you run `npm run dev` or `npm start`
    open: true,
  },
})
