// Ponto de entrada: fontes, estilos e o App.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Fontes auto-hospedadas (pacotes @fontsource): funcionam offline e sem depender do Google Fonts.
import "@fontsource-variable/big-shoulders";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "@fontsource-variable/atkinson-hyperlegible-mono";
import "./estilos/base.css";
import "./estilos/telas.css";

import App from "./App";

createRoot(document.getElementById("raiz")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Só no app publicado: liga o service worker (public/sw.js), que guarda o app e os pedaços do
// mapa já vistos para tudo continuar abrindo se a internet falhar. Em `npm run dev` fica desligado,
// para não servir arquivo antigo durante o desenvolvimento.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js");
      const registro = await navigator.serviceWorker.ready;
      // Na primeira visita os arquivos foram baixados antes de o service worker existir. Passados
      // alguns segundos, a página manda a lista do que baixou para ele guardar também.
      setTimeout(() => {
        const urls = performance.getEntriesByType("resource").map((recurso) => recurso.name)
          .filter((url) => url.startsWith(location.origin) || url.includes("tiles.openfreemap.org"));
        // As fontes só são baixadas quando um texto precisa delas (o carimbo dos códigos, por
        // exemplo, só aparece ao tocar num bueiro). Entram todas na lista para não faltarem depois.
        for (const folha of document.styleSheets) {
          try {
            for (const regra of folha.cssRules) {
              const arquivo = regra instanceof CSSFontFaceRule ? regra.style.getPropertyValue("src").match(/url\(["']?([^"')]+\.woff2)/) : null;
              if (arquivo) urls.push(new URL(arquivo[1], folha.href ?? location.href).href);
            }
          } catch {
            // Folha de estilo de outro endereço: o navegador não deixa ler; não é nossa.
          }
        }
        registro.active?.postMessage({ tipo: "guardar", urls: [...new Set(urls)] });
      }, 5000);
    } catch (erro) {
      console.warn("[SIMA] O modo sem internet não pôde ser ligado.", erro);
    }
  });
}
