import { defineConfig } from '@playwright/test';

// Runs against the exchange simulator, which halts trading in the symbols the QA package lists.
export default defineConfig({
  testDir: '.',
  use: { baseURL: process.env.EXCHANGE_SIM_URL ?? 'http://localhost:4180' },
});
