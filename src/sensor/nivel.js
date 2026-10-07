// Transforma a medida do protótipo do sensor em nível do bueiro.
//
// O protótipo (ESP32) mede a DISTÂNCIA, em centímetros, do sensor até a água. O sensor fica
// embaixo da tampa, apontado para baixo: quanto MENOR a distância, MAIS CHEIO está o bueiro.
// Ele não mede lixo.
//
// O ALCANCE DO SENSOR (informado pelo grupo em 07/10/2026): ele mede de 20 cm a 2000 cm.
// - Abaixo de 20 cm (a "zona cega") o sensor não mede com precisão. Por isso o nível crítico
//   começa ACIMA de 20 cm: se começasse em 20, o sensor só chegaria nele já sem medir direito.
// - Acima de 2000 cm a medida não existe: é erro de leitura.
//
//   distância                    nível (mesma escala do mapa)
//   até `critico`  (30 cm)       4  Crítico
//   até `alerta`   (45 cm)       3  Alto
//   até `atencao`  (60 cm)       2  Médio
//   acima disso                  1  Baixo
//
// Os três limites são desta página e podem ser trocados em "Ajustes do sensor" (a montagem da
// bancada muda de um dia para o outro); ficam guardados no aparelho. O servidor do sensor (o
// programa em Node do grupo do IoT) tem os limites dele, de antes de o alcance ser conhecido
// (crítico 20, alerta 30, atenção 45): a página não os usa para dar o nível, só avisa quando são
// diferentes.
//
// Só faz contas: não fala com o servidor (isso é do servidor.js) nem com a tela.

/** O que o sensor consegue medir, em centímetros. */
export const ALCANCE = Object.freeze({ minimo: 20, maximo: 2000 });

/** Limites em centímetros. `zonaCega` é o mínimo do sensor: abaixo dela a medida não é confiável. */
export const LIMITES_PADRAO = Object.freeze({ zonaCega: ALCANCE.minimo, critico: 30, alerta: 45, atencao: 60 });

/** Acima disto (em cm) a medida não é de um bueiro: é erro de leitura. */
export const DISTANCIA_MAXIMA = ALCANCE.maximo;

const positivo = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/**
 * true se os três limites servem para este sensor: em ordem (crítico < alerta < atenção), com o
 * crítico acima do mínimo que o sensor mede e a atenção dentro do alcance.
 */
export function limitesValidos(limites) {
  const critico = positivo(limites?.critico);
  const alerta = positivo(limites?.alerta);
  const atencao = positivo(limites?.atencao);
  return critico !== null && alerta !== null && atencao !== null
    && critico > ALCANCE.minimo && critico < alerta && alerta < atencao && atencao <= ALCANCE.maximo;
}

/**
 * Confere os limites escolhidos em Ajustes (ou guardados no aparelho). Se faltar algum, a ordem
 * não fizer sentido ou eles não couberem no alcance do sensor, devolve os limites padrão.
 * A zona cega é sempre o mínimo do sensor: não é uma escolha.
 */
export function arrumarLimites(escolhidos) {
  if (!limitesValidos(escolhidos)) return LIMITES_PADRAO;
  return { zonaCega: ALCANCE.minimo, critico: escolhidos.critico, alerta: escolhidos.alerta, atencao: escolhidos.atencao };
}

/**
 * Lê a resposta de GET /api/limites do servidor do sensor:
 *   { "zonaCega": 15, "critico": 20, "alerta": 30, "atencao": 45 }
 * Serve para duas coisas: saber que quem respondeu é mesmo o servidor do sensor, e avisar quando
 * os limites dele são diferentes dos desta página. Não entra na conta do nível.
 * @returns {{ critico: number, alerta: number, atencao: number }|null}  null se a resposta não é a esperada
 */
export function lerLimitesDoServidor(resposta) {
  const critico = positivo(resposta?.critico);
  const alerta = positivo(resposta?.alerta);
  const atencao = positivo(resposta?.atencao);
  if (critico === null || alerta === null || atencao === null || !(critico < alerta && alerta < atencao)) return null;
  return { critico, alerta, atencao };
}

/** true se os dois conjuntos de limites dão o mesmo nível para qualquer distância. */
export function mesmosLimites(a, b) {
  return Boolean(a && b) && a.critico === b.critico && a.alerta === b.alerta && a.atencao === b.atencao;
}

/**
 * true se a distância pode ser uma medida de verdade.
 * Zero, negativo ou um valor além do alcance é o que o sensor devolve quando não recebe o eco
 * de volta; não pode virar "bueiro cheio".
 */
export function distanciaValida(distancia) {
  return typeof distancia === "number" && Number.isFinite(distancia) && distancia > 0 && distancia <= DISTANCIA_MAXIMA;
}

/** Nível de 1 (baixo) a 4 (crítico) para uma distância em cm; null se a medida não vale. */
export function nivelDaDistancia(distancia, limites = LIMITES_PADRAO) {
  if (!distanciaValida(distancia)) return null;
  if (distancia <= limites.critico) return 4;
  if (distancia <= limites.alerta) return 3;
  if (distancia <= limites.atencao) return 2;
  return 1;
}

/**
 * true se a água está tão perto do sensor que a medida deixa de ser confiável (abaixo do mínimo
 * que ele mede). O nível continua crítico: perto assim, o bueiro está cheio de qualquer jeito.
 */
export function naZonaCega(distancia, limites = LIMITES_PADRAO) {
  return distanciaValida(distancia) && distancia < limites.zonaCega;
}

/** Valor do meio de uma lista de números (a média dos dois do meio, se a lista for par). */
export function mediana(valores) {
  const ordem = [...valores].sort((a, b) => a - b);
  if (ordem.length === 0) return null;
  const meio = Math.floor(ordem.length / 2);
  return ordem.length % 2 ? ordem[meio] : (ordem[meio - 1] + ordem[meio]) / 2;
}

/**
 * A distância que a tela mostra: a mediana das leituras válidas entre as mais recentes.
 * Uma medida isolada fora do lugar (o sensor erra de vez em quando) não faz o nível piscar.
 * @param {number[]} recentes  as últimas distâncias recebidas, da mais antiga para a mais nova
 * @returns {number|null}      null se nenhuma delas é uma medida válida
 */
export function distanciaFirme(recentes) {
  const validas = recentes.filter(distanciaValida);
  return validas.length ? mediana(validas) : null;
}

/**
 * Lê a resposta de GET /api/leitura do servidor do sensor:
 *   { "device": "esp32-01", "distancia": 32.4, "status": "atencao", "nivel": 1, "titulo": "Atenção",
 *     "mensagem": "...", "em": "2026-10-07T12:00:00.000Z" }
 * O app usa `distancia` (cm), `em` (para saber se a leitura é nova) e `device`. A classificação
 * do servidor não é usada: o app faz a conta com os limites desta página.
 * @returns {{ distancia: number, em: number|null, marca: string, aparelho: string|null }|null}
 *   null quando ainda não há leitura (o servidor responde `null`) ou a resposta não tem a medida.
 */
export function lerLeitura(resposta) {
  if (!resposta || typeof resposta !== "object" || typeof resposta.distancia !== "number" || Number.isNaN(resposta.distancia)) return null;
  const em = typeof resposta.em === "string" ? Date.parse(resposta.em) : NaN;
  return {
    distancia: resposta.distancia,
    em: Number.isFinite(em) ? em : null,
    marca: typeof resposta.em === "string" ? resposta.em : "",
    aparelho: typeof resposta.device === "string" && resposta.device.trim() ? resposta.device.trim() : null,
  };
}

/**
 * Até que distância o desenho do bueiro vai: um pouco além do limite de "atenção", para sobrar
 * espaço de bueiro vazio. Medidas maiores que isso aparecem com a água no fundo.
 */
export function escalaDoDesenho(limites = LIMITES_PADRAO) {
  return limites.atencao + 25;
}

/** Distância escrita para a tela: "32 cm". */
export function textoDaDistancia(distancia) {
  return `${Math.round(distancia)} cm`;
}
