import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests',
  timeout:45000,
  expect:{timeout:10000},
  use:{
    baseURL:'http://127.0.0.1:3000',
    serviceWorkers:'block',
    trace:'retain-on-failure'
  },
  webServer:{
    command:'node server.js',
    url:'http://127.0.0.1:3000',
    timeout:120000,
    reuseExistingServer:false
  }
});
