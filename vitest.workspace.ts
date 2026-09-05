import { defineConfig } from 'vitest/config'
import preact from '@preact/preset-vite'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          root: './packages/core',
          environment: 'node',
        },
      },
      {
        plugins: [preact()],
        test: {
          name: 'game',
          root: './apps/game',
          environment: 'jsdom',
        },
      },
    ],
  },
})
