import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'./e2e',timeout:60000,workers:1,use:{baseURL:'http://127.0.0.1:5173',headless:true,channel:process.env.CI?undefined:'msedge'},webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:!process.env.CI},reporter:'list' });
