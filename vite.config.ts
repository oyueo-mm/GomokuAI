import { defineConfig } from 'vite';
export default defineConfig({ base: './', optimizeDeps:{include:['onnxruntime-web/wasm']}, worker: { format: 'es' }, build: { target: 'es2022' } });
