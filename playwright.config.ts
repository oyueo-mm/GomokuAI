import { defineConfig } from '@playwright/test';
const port = Number(process.env.E2E_PORT || 5173);
export default defineConfig({ testDir:'./e2e',timeout:60000,workers:1,use:{baseURL:`http://127.0.0.1:${port}`,headless:true,channel:process.env.CI?undefined:'msedge'},webServer:{command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:!process.env.CI},reporter:'list' });
