// Transforma a medida do protótipo do sensor em nível do bueiro.
//
// O protótipo (ESP32) mede a DISTÂNCIA, em centímetros, do sensor até a água. O sensor fica
// embaixo da tampa, apontado para baixo: quanto MENOR a distância, MAIS CHEIO está o bueiro.
// Ele não mede lixo.
//
// A regra é a mesma do servidor do sensor (o programa em Node do grupo do IoT), para a tela do
// app e o painel deles dizerem a mesma coisa:
//
//   distância            servidor do sensor    app (mesma escala do mapa)
//   até `critico`        Crítico               4  Crítico
//   até `alerta`         Alerta                3  Alto
//   até `atencao`        Atenção               2  Médio
//   acima disso          Normal                1  Baixo
//
// Os limites vêm do servidor (GET /api/limites); sem resposta, valem os de LIMITES_PADRAO, que
// são os do código do servidor em 06/10/2026.
//
// Só faz contas: não fala com o servidor (isso é do servidor.js) nem com a tela.

/** Limites em centímetros, iguais aos do servidor do sensor. */
export const LIMITES_PADRAO = Object.freeze({ zonaCega: 15, critico: 20, alerta: 30, atencao: 45 });

/** Acima disto (em cm) a medida não é de um bueiro: é erro de leitura. */
export const DISTANCIA_MAXIMA = 600;

const positivo = (v) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/**
 * Confere os limites recebidos do servidor. Se faltar algum ou a ordem não fizer sentido
 * (crítico < alerta < atenção), devolve os limites padrão.
 * `zonaCega` é a distância abaixo da qual o sensor deixa de medir direito; sem ela, vale 0.
 */
export function arrumarLimites(recebido) {
  const critico = positivo(recebido?.critico);
  const alerta = positivo(recebido?.alerta);
  const atencao = positivo(recebido?.atencao);
  if (critico === null || alerta === null || atencao === null || !(critico < alerta && alerta < atencao)) return LIMITES_PADRAO;
  const zonaCega = positivo(recebido?.zonaCega);
  return { zonaCega: zonaCega !== null && zonaCega <= critico ? zonaCega : 0, critico, alerta, atencao };
}

/**
 * true se a distância pode ser uma medida de verdade.
 * Zero, negativo ou um valor enorme é o que o sensor devolve quando não recebe o eco de volta;
 * não pode virar "bueiro cheio".
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

/** true se a água está tão perto do sensor que a medida deixa de ser confiável. */
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
 * do servidor não é usada: o app refaz a conta com os mesmos limites.
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
