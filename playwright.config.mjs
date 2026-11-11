import { defineConfig, devices } from '@playwright/test'

// Tests de fumée sur le build de production servi par `vite preview`.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.mjs',
  timeout: 45_000,
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4173/ptcgp-collection/', trace: 'off', serviceWorkers: 'block' },
  webServer: {
    command: 'BASE_PATH=/ptcgp-collection/ npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/ptcgp-collection/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 412, height: 900 }, isMobile: false } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
})
