import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Injeta o <link> da fonte auto-hospedada no HTML transformado.
 * Mantém index.html e o entry da app intocados (fronteira MI-11:
 * apps/game/src/pwa/** + seção VitePWA deste arquivo).
 */
function injectFontLink(): Plugin {
  const tag = {
    tag: 'link',
    attrs: { rel: 'stylesheet', href: '/src/pwa/fonts.css' },
    injectTo: 'head' as const,
  }
  return {
    name: 'circuit-router:inject-font',
    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [tag]
      },
    },
  }
}

export default defineConfig({
  plugins: [
    preact(),
    injectFontLink(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registro injetado no HTML; nenhum import no código da app.
      injectRegister: 'auto',
      includeAssets: ['icons/*.png', 'fonts/*.woff2'],
      manifest: {
        name: 'Circuit Router',
        short_name: 'Circuit Router',
        description:
          'Circuit Router — jogo educativo de circuitos lógicos: roteie sinais, ligue portas lógicas e descubra como os circuitos pensam.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f3f6fb',
        theme_color: '#2563eb',
        categories: ['education', 'games', 'puzzle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,svg,ico,json}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      // SW desligado em dev (padrão): só registra em produção/preview.
    }),
  ],
})
