// Modo vitrine: o roteiro que o app segue sozinho quando ninguém está mexendo.
//
// Para que serve: numa feira, o aparelho fica parado na mesa boa parte do tempo. Com o modo
// vitrine ligado (Menu → "Modo vitrine"), depois de um tempo sem toque o app troca o clima da
// demonstração e passeia pelo mapa, mostrando o que o SIMA faz. No primeiro toque ele para e o
// app volta a ser de quem tocou.
//
// Só existe na demonstração (é ela que tem o clima para trocar) e vem desligado.
//
// Este arquivo tem só o roteiro e a escolha do bueiro a visitar; quem move o mapa e conta o tempo
// é src/telas/useVitrine.js.

import { nivelVisivel } from "./modelo.js";
import { trechoDoBueiro } from "../mapa/ruasAfetadas.js";

/** Tempo sem ninguém tocar, em milissegundos, até o passeio começar. */
export const ESPERA_MS = 45000;

/**
 * As cenas do passeio, em ordem; depois da última, volta para a primeira.
 *   clima         o clima da demonstração nesta cena (ids de CLIMAS, em demo.js)
 *   camera        "cidade" mostra todos os bueiros; "bueiro" aproxima de um e abre o cartão dele
 *   nivelMinimo   só para "bueiro": o nível mínimo do bueiro visitado (3 = alto, 4 = crítico)
 *   ms            quanto a cena dura. A chuva leva 12 s para atravessar a cidade, então as cenas
 *                 que trocam o clima duram mais que isso.
 * O passeio conta a mesma história do roteiro da demonstração: sol, a chuva chegando, um bueiro
 * em risco de perto (com a rua pintada), a chuva extrema, um bueiro crítico e a volta do sol.
 */
export const CENAS = [
  { id: "sol", clima: "sol", camera: "cidade", ms: 8000 },
  { id: "chuva-chega", clima: "chuva-forte", camera: "cidade", ms: 15000 },
  { id: "bueiro-em-risco", clima: "chuva-forte", camera: "bueiro", nivelMinimo: 3, ms: 10000 },
  { id: "chuva-extrema", clima: "chuva-extrema", camera: "cidade", ms: 15000 },
  { id: "bueiro-critico", clima: "chuva-extrema", camera: "bueiro", nivelMinimo: 4, ms: 11000 },
  { id: "sol-volta", clima: "sol", camera: "cidade", ms: 15000 },
];

/** Duração de uma volta inteira do passeio, em milissegundos. */
export const VOLTA_MS = CENAS.reduce((soma, cena) => soma + cena.ms, 0);

/**
 * Escolhe o bueiro que o passeio visita: o de maior nível, depois o que está transbordando, depois
 * o de maior chance. Entre os candidatos, prefere os que têm o trecho de rua desenhado no mapa
 * (é o que a cena quer mostrar). A escolha é sempre a mesma para a mesma situação: o passeio
 * visita os mesmos lugares a cada volta, e os pedaços do mapa deles ficam guardados no aparelho.
 * @param {Array} pontos   os bueiros (formato de modelo.js)
 * @param {Date} agora
 * @param {object} [opcoes]
 * @param {number} [opcoes.nivelMinimo]  3 = alto ou crítico; 4 = só crítico
 * @param {Set<string>} [opcoes.evitar]  ids já visitados nesta volta
 * @returns {object|null} o ponto escolhido, ou null se nenhum bueiro chega ao nível pedido
 */
export function escolherBueiro(pontos, agora, { nivelMinimo = 3, evitar = new Set() } = {}) {
  let candidatos = pontos.filter((p) => !evitar.has(p.id) && (nivelVisivel(p, agora) ?? 0) >= nivelMinimo
    && Number.isFinite(p.lat) && Number.isFinite(p.lon));
  const comRua = candidatos.filter((p) => trechoDoBueiro(p));
  if (comRua.length) candidatos = comRua;
  if (candidatos.length === 0) return null;
  const peso = (p) => [nivelVisivel(p, agora) ?? 0, p.medicaoTransbordando ? 1 : 0, p.probabilidade ?? 0];
  return candidatos.reduce((melhor, p) => {
    const a = peso(p);
    const b = peso(melhor);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i] ? p : melhor;
    return String(p.id) < String(melhor.id) ? p : melhor; // empate total: o de menor id, para ser sempre o mesmo
  });
}
