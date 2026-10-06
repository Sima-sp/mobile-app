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
