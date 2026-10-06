// A marca do SIMA: uma tampa de bueiro que "enche" conforme o nível de risco.
// O risco aparece na FORMA (quanto a tampa está cheia) além da cor, então continua legível
// para quem não distingue as cores.

import { corNivel, fracaoTampa, rotuloNivel } from "../dados/niveis";

/** Recorte circular usado por todas as tampas. Renderizar uma vez só, na raiz do app. */
export function DefinicoesSvg() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <clipPath id="sima-lid-clip" clipPathUnits="userSpaceOnUse"><circle cx="12" cy="12" r="9.2" /></clipPath>
      </defs>
    </svg>
  );
}

/**
 * Tampa pequena, para marcadores, listas e selos.
 * @param {number|null} nivel  1 a 4; null desenha a tampa vazia e tracejada (sem previsão).
 * @param {number} tamanho     lado em px
 */
export function Tampa({ nivel, tamanho = 24 }) {
  const cor = corNivel(nivel);
  // A grade interna vai de y = 2,8 (cheia) a 21,2 (vazia).
  const topoDaAgua = 21.2 - 18.4 * fracaoTampa(nivel);
  return (
    <svg className="lidmark" width={tamanho} height={tamanho} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10.6" strokeWidth="2.3" strokeDasharray={nivel ? undefined : "3.2 2.6"}
        style={{ fill: "var(--lid-bg)", stroke: cor }} />
      {nivel ? <rect x="0" y={topoDaAgua} width="24" height="24" clipPath="url(#sima-lid-clip)" style={{ fill: cor }} /> : null}
      <path d="M8.4 3.8v16.4M12 2.8v18.4M15.6 3.8v16.4" strokeWidth="1.5" fill="none" style={{ stroke: "var(--lid-bg)" }} />
    </svg>
  );
}

/** Selo com tampa + nome do nível: "◐ Alto". Sem nível, mostra "Sem previsão" em tinta neutra. */
export function SeloNivel({ nivel }) {
  return (
    <span className={nivel ? `rb rb-${nivel}` : "rb"} style={nivel ? undefined : { color: "var(--bone-500)" }}>
      <Tampa nivel={nivel} tamanho={16} />
      {rotuloNivel(nivel)}
    </span>
  );
}
