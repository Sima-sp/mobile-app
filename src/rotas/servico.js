// Conversa com os serviços de fora usados pelas rotas:
//
// - Rotas: Valhalla (projeto aberto), no servidor público da FOSSGIS (a associação do
//   OpenStreetMap na Alemanha). Não pede chave e aceita "áreas a evitar". É um servidor de uso
//   justo, sem garantia: no máximo um pedido por segundo, e pode ficar fora do ar. As áreas a
//   evitar têm limite (100 vértices e 10 km de perímetro por pedido; ver REGRAS em planejar.js).
// - Busca de endereço: Photon (komoot), também aberto e sem chave.
//
// Os dois usam os dados do OpenStreetMap. Os endereços dos servidores ficam em src/config.js e
// podem ser trocados no .env.local (VITE_ROTAS_URL, VITE_ENDERECOS_URL).
//
// Privacidade: o app só manda a esses serviços a partida e a chegada da rota pedida (e o texto
// digitado na busca). Nada é enviado sem a pessoa pedir uma rota.

import { CONFIG } from "../config.js";
import { decodificarPolilinha } from "./geometria.js";

/** Erro das rotas. `tipo`: "sem-caminho" (não existe trajeto), "rede" (serviço não respondeu) ou "servico". */
export class ErroRota extends Error {
  constructor(tipo, mensagem) {
    super(mensagem);
    this.name = "ErroRota";
    this.tipo = tipo;
  }
}

// O servidor público pede no máximo um pedido por segundo: os pedidos entram em fila.
let proximaVaga = 0;
async function esperarVaga(sinal) {
  const agora = Date.now();
  const espera = Math.max(0, proximaVaga - agora);
  proximaVaga = Math.max(agora, proximaVaga) + CONFIG.rotas.intervaloMs;
  if (espera === 0) return;
  await new Promise((resolver, rejeitar) => {
    const relogio = setTimeout(resolver, espera);
    sinal?.addEventListener("abort", () => {
      clearTimeout(relogio);
      rejeitar(new DOMException("Pedido cancelado", "AbortError"));
    }, { once: true });
  });
}

/** Junta o sinal de cancelamento de quem chamou com um tempo limite. */
function comTempoLimite(sinal, ms) {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(new DOMException("Tempo esgotado", "TimeoutError")), ms);
  sinal?.addEventListener("abort", () => controle.abort(sinal.reason), { once: true });
  return { sinal: controle.signal, limpar: () => clearTimeout(relogio) };
}

/**
 * Traça uma rota de carro.
 * @param {object} pedido
 * @param {[number, number]} pedido.origem   [lon, lat]
 * @param {[number, number]} pedido.destino  [lon, lat]
 * @param {Array} [pedido.areas]             áreas a evitar (anéis de [lon, lat])
 * @param {AbortSignal} [pedido.sinal]       para cancelar
 * @returns {Promise<{ caminho: Array<[number, number]>, minutos: number, km: number,
 *   trechos: Array<{nome: string, km: number}>,
 *   manobras: Array<{ tipo: number, texto: string, rua: string, km: number, segundos: number, inicio: number, saida: number|null }> }>}
 *   `manobras` é o passo a passo usado pela tela de viagem (src/rotas/viagem.js): `tipo` é o código
 *   da manobra no Valhalla, `texto` a frase pronta em português, `rua` a via em que se entra,
 *   `inicio` o índice do `caminho` onde a manobra acontece e `saida` a saída da rotatória.
 */
export async function pedirRotaDeCarro({ origem, destino, areas = [], sinal }) {
  await esperarVaga(sinal);
  const corpo = {
    locations: [{ lon: origem[0], lat: origem[1] }, { lon: destino[0], lat: destino[1] }],
    costing: "auto",
    directions_options: { units: "kilometers", language: "pt-BR" },
  };
  if (areas.length) corpo.exclude_polygons = areas;

  const limite = comTempoLimite(sinal, CONFIG.rotas.tempoLimiteMs);
  let resposta;
  let dados;
  try {
    // Corpo sem cabeçalho de JSON de propósito: assim o navegador não faz o pedido extra de
    // permissão (preflight) e o servidor aceita do mesmo jeito.
    resposta = await fetch(`${CONFIG.rotas.urlValhalla}/route`, { method: "POST", body: JSON.stringify(corpo), signal: limite.sinal });
    dados = await resposta.json();
  } catch (erro) {
    if (sinal?.aborted) throw erro; // quem chamou cancelou: não é falha do serviço
    throw new ErroRota("rede", "O serviço de rotas não respondeu.");
  } finally {
    limite.limpar();
  }

  if (!resposta.ok || !dados.trip) {
    // 442: não achou caminho. 170/171: partida ou chegada sem rua por perto ou dentro de área evitada.
    const semCaminho = [442, 170, 171].includes(dados.error_code) || /no path|no suitable edges/i.test(dados.error ?? "");
    throw new ErroRota(semCaminho ? "sem-caminho" : "servico", dados.error ?? `Resposta ${resposta.status} do serviço de rotas.`);
  }

  const perna = dados.trip.legs[0];
  return {
    caminho: decodificarPolilinha(perna.shape),
    minutos: dados.trip.summary.time / 60,
    km: dados.trip.summary.length,
    trechos: (perna.maneuvers ?? []).map((m) => ({ nome: m.street_names?.[0] ?? "", km: m.length ?? 0 })),
    manobras: (perna.maneuvers ?? []).map((m) => ({
      tipo: m.type ?? 0,
      texto: m.instruction ?? "",
      rua: m.street_names?.[0] ?? m.begin_street_names?.[0] ?? "",
      km: m.length ?? 0,
      segundos: m.time ?? 0,
      inicio: m.begin_shape_index ?? 0,
      saida: m.roundabout_exit_count ?? null,
    })),
  };
}

/** Monta o nome e o complemento de um resultado da busca de endereço. */
function descreverLugar(p) {
  const rua = [p.street, p.housenumber].filter(Boolean).join(", ");
  const nome = p.name || rua || p.district || p.city || "Lugar sem nome";
  const partes = [p.name && rua && rua !== p.name ? rua : null, p.district || p.locality, p.city !== "São Paulo" ? p.city : null];
  return { nome, detalhe: [...new Set(partes.filter(Boolean))].filter((parte) => parte !== nome).join(" · ") };
}

/**
 * Procura endereços e lugares dentro da Grande São Paulo.
 * @returns {Promise<Array<{ id: string, nome: string, detalhe: string, lon: number, lat: number }>>}
 */
export async function buscarEnderecos(texto, { sinal } = {}) {
  const [[oeste, sul], [leste, norte]] = CONFIG.mapa.limites;
  const [lonCentro, latCentro] = CONFIG.mapa.centro;
  const consulta = new URLSearchParams({ q: texto, limit: "7", bbox: `${oeste},${sul},${leste},${norte}`, lat: String(latCentro), lon: String(lonCentro) });
  const limite = comTempoLimite(sinal, CONFIG.rotas.tempoLimiteMs);
  try {
    const resposta = await fetch(`${CONFIG.rotas.urlPhoton}/api/?${consulta}`, { signal: limite.sinal });
    if (!resposta.ok) throw new ErroRota("servico", `Resposta ${resposta.status} da busca de endereço.`);
    const dados = await resposta.json();
    const vistos = new Set();
    const lugares = [];
    for (const item of dados.features ?? []) {
      const [lon, lat] = item.geometry?.coordinates ?? [];
      if (typeof lon !== "number" || typeof lat !== "number") continue;
      const { nome, detalhe } = descreverLugar(item.properties ?? {});
      const chave = `${nome}|${detalhe}`;
      if (vistos.has(chave)) continue; // a mesma rua costuma vir em vários pedaços
      vistos.add(chave);
      lugares.push({ id: `${item.properties?.osm_type ?? ""}${item.properties?.osm_id ?? chave}`, nome, detalhe, lon, lat });
    }
    return lugares;
  } catch (erro) {
    if (sinal?.aborted || erro instanceof ErroRota) throw erro;
    throw new ErroRota("rede", "A busca de endereço não respondeu.");
  } finally {
    limite.limpar();
  }
}
