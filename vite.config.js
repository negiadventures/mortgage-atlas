import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Where the built assets are asked for, which is the whole reason the site was
 * blank.
 *
 * GitHub Pages serves a project repo from a subfolder, so a Pages build has to
 * ask for `/mortgage-atlas/assets/...`. Vercel serves it from the root of
 * mortgage.negiventures.com, where that path does not exist: the HTML loaded,
 * the script 404ed, no JavaScript ran, and the page rendered as an empty div
 * with no error anywhere to say why.
 *
 * Hardcoding either value breaks the other host, so the Pages workflow sets
 * DEPLOY_TARGET and everything else gets the root.
 */
const base = process.env.DEPLOY_TARGET === 'gh-pages' ? '/mortgage-atlas/' : '/'

export default defineConfig({
  base,
  plugins: [react()],
})
