import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Served from the root of mortgage.negiventures.com.
 *
 * Worth stating rather than leaving to the default, because getting it wrong is
 * what made the site blank. It was set to /mortgage-atlas/ for GitHub Pages,
 * which serves a project repo from a subfolder. Vercel serves from a domain
 * root, so the HTML asked for /mortgage-atlas/assets/index-*.js, got a 404, and
 * no JavaScript ran: an empty div, and nothing in the console to explain it
 * beyond the 404 itself.
 *
 * Anything other than '/' here needs the host to be serving from that subpath.
 */
export default defineConfig({
  base: '/',
  plugins: [react()],
})
