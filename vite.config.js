import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // Atalho para o backend em desenvolvimento: tudo que o app pede em /api/... o servidor do Vite
  // repassa para o backend Java. Para o navegador é o mesmo endereço do app, então não depende de
  // CORS liberado no backend, e funciona também abrindo o app pelo celular na mesma rede
  // (npm run dev:rede). Para usar: VITE_API_URL=/api no .env.local.
  const repasse = {
    "/api": {
      target: env.SIMA_BACKEND || "http://localhost:8080",
      changeOrigin: true,
      rewrite: (caminho) => caminho.replace(/^\/api/, ""),
    },
  };

  return {
    // base "./": os arquivos do build usam caminhos relativos, então a pasta dist/ funciona em
    // subpasta (GitHub Pages), dentro do Capacitor e servida pelo Spring em /static.
    base: "./",
    plugins: [react()],
    // O MapLibre processa os tiles num web worker em formato de módulo (ver src/mapa/MapaBase.jsx).
    worker: { format: "es" },
    server: { port: 5173, proxy: repasse },
    preview: { proxy: repasse },
  };
});
