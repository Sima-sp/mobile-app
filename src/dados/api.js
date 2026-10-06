// Conversa com o backend Java (módulo `previsao`).
//
// Hoje o app usa uma rota só: GET /previsoes, que devolve um item por sensor com a última
// previsão e o status (VALIDA, DESATUALIZADA, SEM_PREVISAO). A conversão para o formato do app
// fica em modelo.js.
//
// O que o backend precisa garantir para isto funcionar no navegador:
//   - /previsoes acessível sem login (o mapa é público);
//   - CORS liberado para a origem do app;
//   - latitude, longitude e vizinhança do sensor em cada item.

import { CONFIG } from "../config.js";
import { normalizarPrevisao } from "./modelo.js";

/** Erro de comunicação com o backend, com uma mensagem que pode ir para a tela. */
export class ErroApi extends Error {
  constructor(mensagem, causa) {
    super(mensagem);
    this.name = "ErroApi";
    this.causa = causa;
  }
}

async function pedirJson(caminho) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), CONFIG.tempoLimiteMs);
  try {
    const resposta = await fetch(`${CONFIG.urlApi}${caminho}`, {
      signal: controle.signal,
      headers: { Accept: "application/json" },
    });
    if (!resposta.ok) throw new ErroApi(`O servidor respondeu com erro (${resposta.status}).`);
    return await resposta.json();
  } catch (erro) {
    if (erro instanceof ErroApi) throw erro;
    if (erro.name === "AbortError") throw new ErroApi("O servidor demorou demais para responder.", erro);
    throw new ErroApi("Não foi possível falar com o servidor.", erro);
  } finally {
    clearTimeout(relogio);
  }
}

/**
 * Busca a situação de todos os sensores.
 * @returns {Promise<{ pontos: object[], semPosicao: number }>} `semPosicao` conta os itens que
 *   vieram sem latitude/longitude e por isso ficaram fora do mapa.
 */
export async function buscarPontos() {
  const corpo = await pedirJson("/previsoes");
  // Aceita lista direta ou página do Spring ({ content: [...] }).
  const itens = Array.isArray(corpo) ? corpo : corpo?.content;
  if (!Array.isArray(itens)) throw new ErroApi("O servidor respondeu num formato inesperado.");

  const pontos = itens.map(normalizarPrevisao).filter(Boolean);
  const semPosicao = itens.length - pontos.length;
  if (semPosicao > 0) {
    console.warn(`[SIMA] ${semPosicao} item(ns) de /previsoes vieram sem id ou posição e ficaram fora do mapa.`);
  }
  return { pontos, semPosicao };
}
