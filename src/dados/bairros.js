// Agrupa os pontos por bairro para a tela Bairros e para a busca.

import { compararPorGravidade, nivelVisivel } from "./modelo.js";

/**
 * Resumo de cada bairro.
 * @returns {Array<{ nome, pontos, total, contagem: [baixo, medio, alto, critico], semPrevisao, pior, chuvaMedia }>}
 *   ordenado do bairro em pior situação para o mais tranquilo.
 */
export function resumirBairros(pontos, agora = new Date()) {
  const mapa = new Map();
  for (const ponto of pontos) {
    if (!mapa.has(ponto.bairro)) mapa.set(ponto.bairro, []);
    mapa.get(ponto.bairro).push(ponto);
  }

  const bairros = [...mapa.entries()].map(([nome, lista]) => {
    const contagem = [0, 0, 0, 0];
    let semPrevisao = 0;
    let pior = null;
    for (const ponto of lista) {
      const nivel = nivelVisivel(ponto, agora);
      if (!nivel) { semPrevisao += 1; continue; }
      contagem[nivel - 1] += 1;
      if (pior === null || nivel > pior) pior = nivel;
    }
    const chuvas = lista.map((p) => p.chuvaRecente3h).filter((c) => c !== null && c !== undefined);
    return {
      nome,
      pontos: [...lista].sort(compararPorGravidade),
      total: lista.length,
      contagem,
      semPrevisao,
      pior,
      chuvaMedia: chuvas.length ? chuvas.reduce((a, c) => a + c, 0) / chuvas.length : null,
    };
  });

  return bairros.sort((a, b) => (b.pior ?? 0) - (a.pior ?? 0) || b.contagem[3] - a.contagem[3]
    || b.contagem[2] - a.contagem[2] || a.nome.localeCompare(b.nome, "pt-BR"));
}
