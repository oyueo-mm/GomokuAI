import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'./e2e-static',outputDir:'test-results-pages',workers:1,timeout:60000,use:{baseURL:'http://127.0.0.1:4173/GomokuAI/',headless:true,channel:process.env.CI?undefined:'msedge'},webServer:{command:'npm run preview -- --host 127.0.0.1 --base /GomokuAI/',url:'http://127.0.0.1:4173/GomokuAI/'},reporter:'list'});
