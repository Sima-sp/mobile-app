import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const arquivo = (nome) => fileURLToPath(new URL(nome, import.meta.url));

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

  // O projeto tem DUAS páginas: o app (index.html) e o painel do sensor (sensor.html), que é
  // separado do app e ocupa a tela inteira. No modo "painel" (npm run painel) sai só o painel, com
  // fontes e estilos embutidos, para o ferramentas/painel-unico.mjs juntar tudo num arquivo só.
  const painelUnico = mode === "painel";
  const build = painelUnico
    ? { outDir: "dist-painel", emptyOutDir: true, assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false,
        rolldownOptions: { input: { sensor: arquivo("./sensor.html") } } }
    : { rolldownOptions: { input: { index: arquivo("./index.html"), sensor: arquivo("./sensor.html") } } };

  return {
    // base "./": os arquivos do build usam caminhos relativos, então a pasta dist/ funciona em
    // subpasta (GitHub Pages), dentro do Capacitor e servida pelo Spring em /static.
    base: "./",
    plugins: [react()],
    build,
    // O arquivo único não leva os ícones nem o service worker da pasta public/.
    publicDir: painelUnico ? false : "public",
    // O MapLibre processa os tiles num web worker em formato de módulo (ver src/mapa/MapaBase.jsx).
    worker: { format: "es" },
    server: { port: 5173, proxy: repasse },
    preview: { proxy: repasse },
  };
});
