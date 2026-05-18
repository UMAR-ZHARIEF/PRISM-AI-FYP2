import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // Live MJPEG stream from face_recognition.py (annotated webcam feed).
      // Python's http.server holds the long-lived multipart response open;
      // ws:false is fine here since MJPEG is plain HTTP, but we disable any
      // proxy-level timeout so the stream doesn't drop after a minute.
      '/stream': {
        target: 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
})
