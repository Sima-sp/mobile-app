// Ponto de entrada do painel do sensor (sensor.html): fontes, estilos e o Painel.
//
// É uma página separada do app: não carrega o mapa nem as outras telas. Reaproveita do app só o
// que é comum: os tokens e componentes de base.css, a tampa e a preferência de tema.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Fontes auto-hospedadas (pacotes @fontsource): funcionam sem internet.
import "@fontsource-variable/big-shoulders";
import "@fontsource-variable/atkinson-hyperlegible-next";
import "../estilos/base.css";
import "../estilos/sensor.css";

import { ProvedorPreferencias } from "../preferencias/PreferenciasContexto";
import { DefinicoesSvg } from "../componentes/Tampa";
import Painel from "./Painel";

createRoot(document.getElementById("raiz")).render(
  <StrictMode>
    <ProvedorPreferencias>
      <DefinicoesSvg />
      <Painel />
    </ProvedorPreferencias>
  </StrictMode>,
);

// Na página publicada junto do app, liga o mesmo service worker do app (public/sw.js): depois de
// aberta uma vez com internet, a página continua abrindo sem ela. No arquivo único
// (npm run painel) não há service worker: o arquivo já tem tudo dentro.
if (import.meta.env.PROD && import.meta.env.MODE !== "painel" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((erro) => console.warn("[SIMA] O modo sem internet não pôde ser ligado.", erro));
  });
}
