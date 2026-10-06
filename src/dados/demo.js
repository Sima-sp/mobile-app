// Demonstração: bueiros espalhados pela capital, todos com sensor funcionando, e um "clima" que
// pode ser trocado na hora (sol, chuvisco, chuva forte, chuva extrema).
//
// É usada quando o app não tem backend configurado (ou em `npm run demo`) e aparece sempre
// identificada na tela como demonstração.
//
// O QUE É REAL: os lugares. São os pontos de alagamento recorrente que o modelo de IA conhece
// (ver pontosCapital.js), com a frequência histórica e a distância ao córrego de cada um.
// O QUE É INVENTADO: as leituras, a chuva e as previsões. Mas elas não são sorteadas: seguem a
// mesma lógica do sistema de verdade, para a demonstração contar a história certa.
//
//   1. Cada ponto tem uma SENSIBILIDADE fixa: quem alagou mais vezes e está mais perto de um
//      córrego reage mais à chuva.
//   2. O clima define uma INTENSIDADE de 0 a 1. A chuva em milímetros, o nível da água e a chance
//      de alagar saem dela e da sensibilidade do ponto.
//   3. A chance vira nível pelos limiares reais do modelo v1 (médio a partir de 0,41 %, alto a
//      partir de 1,19 %, crítico a partir de 25 %).
//   4. A leitura do sensor ajusta o nível, como no serviço de IA: água em 100 % é "transbordando
//      agora" (crítico, medido); água a partir de 80 % sobe um nível; lixo a partir de 60 % com
//      chuva também.
//
// Ao trocar o clima nada muda de uma vez: a chuva "entra" pela cidade de oeste para leste e cada
// ponto leva alguns segundos para chegar ao novo estado.

import { PONTOS_CAPITAL } from "./pontosCapital.js";

const MINUTO = 60 * 1000;

/** As condições de clima da demonstração, na ordem dos botões (e das teclas 1 a 4). */
export const CLIMAS = [
  { id: "sol", rotulo: "Sol", intensidade: 0 },
  { id: "chuvisco", rotulo: "Chuvisco", intensidade: 0.22 },
  { id: "chuva-forte", rotulo: "Chuva forte", intensidade: 0.68 },
  { id: "chuva-extrema", rotulo: "Chuva extrema", intensidade: 1 },
];

/** Limiares de probabilidade do modelo v1 (ml-service/models/thresholds_v1.json). */
export const LIMIARES = { medio: 0.0041, alto: 0.0119, critico: 0.25 };

/** Quanto tempo a frente de chuva leva para cruzar a cidade e quanto cada ponto leva para mudar. */
const TRAVESSIA_MS = 7000;
const SUBIDA_MS = 5000;

const limitar = (v, min, max) => Math.min(max, Math.max(min, v));
const suave = (t) => t * t * (3 - 2 * t);

/** Número "aleatório" fixo entre 0 e 1 para um ponto: o mesmo ponto dá sempre o mesmo valor. */
function fixo(id, semente) {
  let h = 2166136261 ^ semente;
  for (const letra of `${id}:${semente}`) h = Math.imul(h ^ letra.charCodeAt(0), 16777619);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967295;
}

// Posição de cada ponto na travessia da chuva (0 = primeiro a ser atingido, 1 = último).
const LONS = PONTOS_CAPITAL.map((p) => p.lon);
const LATS = PONTOS_CAPITAL.map((p) => p.lat);
const [LON_MIN, LON_MAX] = [Math.min(...LONS), Math.max(...LONS)];
const [LAT_MIN, LAT_MAX] = [Math.min(...LATS), Math.max(...LATS)];

/** Características fixas de cada ponto, calculadas uma vez. */
const BASE = PONTOS_CAPITAL.map((p) => {
  const historico = Math.min(1, Math.log1p(p.freqHistorica) / Math.log1p(12));
  const pertoDoCorrego = Math.exp(-p.distCorrego / 150);
  return {
    ...p,
    sensibilidade: limitar(0.62 * historico + 0.26 * pertoDoCorrego + 0.12 * fixo(p.id, 1), 0, 1),
    lixo: Math.round(8 + 72 * fixo(p.id, 2) ** 1.25),
    aguaSeca: 4 + 13 * fixo(p.id, 3),
    leituraHa: 1 + Math.floor(fixo(p.id, 4) * 8),
    previsaoHa: 1 + Math.floor(fixo(p.id, 5) * 4),
    // A chuva não cai igual na cidade toda: varia em manchas de alguns quilômetros.
    manchaDeChuva: 1 + 0.2 * Math.sin(p.lon * 42 + 1.3) * Math.cos(p.lat * 37 + 0.4),
    atraso: 0.8 * ((p.lon - LON_MIN) / (LON_MAX - LON_MIN)) + 0.2 * ((p.lat - LAT_MIN) / (LAT_MAX - LAT_MIN)),
  };
});

const intensidadeDe = (clima) => CLIMAS.find((c) => c.id === clima)?.intensidade ?? 0;

/* ───────────── Estado do clima ───────────── */

/**
 * Estado inicial: o clima já "assentado", sem transição.
 * @returns {{ clima: string, inicio: number, origem: number[] | null }}
 */
export function criarEstadoDemo(clima = "sol") {
  return { clima, inicio: 0, origem: null };
}

/** Intensidade da chuva em cada ponto neste instante (lista na ordem de PONTOS_CAPITAL). */
export function intensidades(estado, agora = new Date()) {
  const alvo = intensidadeDe(estado.clima);
  if (!estado.origem) return BASE.map(() => alvo);
  const passado = agora.getTime() - estado.inicio;
  return BASE.map((p, i) => {
    const progresso = limitar((passado - p.atraso * TRAVESSIA_MS) / SUBIDA_MS, 0, 1);
    return estado.origem[i] + (alvo - estado.origem[i]) * suave(progresso);
  });
}

/** true enquanto a cidade ainda está mudando para o clima escolhido. */
export function emTransicao(estado, agora = new Date()) {
  return Boolean(estado.origem) && agora.getTime() - estado.inicio < TRAVESSIA_MS + SUBIDA_MS;
}

/** Troca o clima. A mudança parte de como cada ponto está agora, mesmo no meio de outra troca. */
export function trocarClima(estado, clima, agora = new Date()) {
  if (clima === estado.clima) return estado;
  return { clima, inicio: agora.getTime(), origem: intensidades(estado, agora) };
}

/* ───────────── Do clima para os dados de cada ponto ───────────── */

/**
 * Da "pressão" sobre o bueiro (0 = seco, 1 = no limite) para a chance de alagar.
 * A tabela foi escolhida para a chance cruzar os limiares reais do modelo em pontos que dão uma
 * cidade plausível: com chuva forte, cerca de um quarto dos pontos fica em baixo e um quarto em
 * alto; com chuva extrema, quase todos passam de médio. Entre uma linha e outra a chance cresce
 * em escala logarítmica, como as probabilidades do modelo de verdade.
 */
const PRESSAO_PARA_CHANCE = [
  [0, 0.0007],
  [0.33, LIMIARES.medio],
  [0.5, LIMIARES.alto],
  [0.88, LIMIARES.critico],
  [1.2, 0.6],
];

function chancePelaPressao(pressao) {
  const tabela = PRESSAO_PARA_CHANCE;
  if (pressao >= tabela[tabela.length - 1][0]) return tabela[tabela.length - 1][1];
  for (let i = 1; i < tabela.length; i += 1) {
    const [x0, p0] = tabela[i - 1];
    const [x1, p1] = tabela[i];
    if (pressao <= x1) {
      const fracao = (pressao - x0) / (x1 - x0);
      return Math.exp(Math.log(p0) + (Math.log(p1) - Math.log(p0)) * fracao);
    }
  }
  return tabela[0][1];
}

function nivelPelaChance(probabilidade) {
  if (probabilidade >= LIMIARES.critico) return 4;
  if (probabilidade >= LIMIARES.alto) return 3;
  if (probabilidade >= LIMIARES.medio) return 2;
  return 1;
}

/** Leituras e previsão de um ponto para uma intensidade de chuva. Exportada para os testes. */
export function situacaoDoPonto(p, intensidade) {
  const forca = intensidade * p.manchaDeChuva;
  // "Pressão" sobre o bueiro: chuva pesada pelo quanto o lugar é sensível, mais o efeito do lixo.
  const pressao = limitar(forca * (0.15 + 0.85 * p.sensibilidade) + 0.05 * forca * (p.lixo / 100), 0, 1.2);

  const chuvaRecente3h = Math.round(66 * forca ** 2.2 * 10) / 10;
  const chuvaPrevista3h = Math.round(31 * forca ** 1.8 * 10) / 10;
  const agua = Math.round(limitar(p.aguaSeca + 122 * pressao ** 1.36, 0, 100));
  const probabilidade = chancePelaPressao(pressao);

  const nivelModelo = nivelPelaChance(probabilidade);
  const medicaoTransbordando = agua >= 100;
  let nivel = nivelModelo;
  if (agua >= 80) nivel += 1;
  if (p.lixo >= 60 && chuvaRecente3h >= 0.5) nivel += 1;
  nivel = medicaoTransbordando ? 4 : Math.min(4, nivel);

  return { chuvaRecente3h, chuvaPrevista3h, agua, probabilidade, nivelModelo, nivel, medicaoTransbordando };
}

/** Curva das últimas 12 horas: nível de tempo seco e, nas 3 horas finais, a subida até agora. */
function historicoAte(aguaSeca, aguaAtual, id) {
  const serie = [];
  for (let hora = 0; hora < 9; hora += 1) serie.push(Math.round(aguaSeca + 2 * (fixo(id, 10 + hora) - 0.5)));
  serie.push(Math.round(aguaSeca + (aguaAtual - aguaSeca) * 0.3));
  serie.push(Math.round(aguaSeca + (aguaAtual - aguaSeca) * 0.7));
  serie.push(aguaAtual);
  return serie.map((v) => limitar(v, 0, 100));
}

/**
 * Devolve os pontos da demonstração no formato do app (ver src/dados/modelo.js).
 * @param {Date} agora   os horários são calculados a partir dele, para a tela nunca "envelhecer"
 * @param {object} estado estado do clima (criarEstadoDemo / trocarClima)
 */
export function gerarPontosDemo(agora = new Date(), estado = criarEstadoDemo()) {
  const atras = (minutos) => new Date(agora.getTime() - minutos * MINUTO);
  const locais = intensidades(estado, agora);

  return BASE.map((p, i) => {
    const s = situacaoDoPonto(p, locais[i]);
    return {
      id: p.id,
      codigo: p.codigo,
      endereco: p.endereco,
      bairro: p.bairro,
      lat: p.lat,
      lon: p.lon,
      statusSensor: "ATIVO",
      nivel: s.nivel,
      nivelModelo: s.nivelModelo,
      ajusteSensorAplicado: s.nivel > s.nivelModelo,
      probabilidade: s.probabilidade,
      janelaHoras: 3,
      status: "VALIDA",
      geradaEm: atras(p.previsaoHa),
      validaAte: atras(p.previsaoHa - 30), // a previsão vale 30 minutos
      medicaoTransbordando: s.medicaoTransbordando,
      semLeituraSensor: false,
      simulada: false,
      origem: "MODELO",
      modeloVersao: "demonstração",
      agua: s.agua,
      lixo: p.lixo,
      leituraEm: atras(p.leituraHa),
      chuvaRecente3h: s.chuvaRecente3h,
      chuvaPrevista3h: s.chuvaPrevista3h,
      historicoAgua: historicoAte(Math.round(p.aguaSeca), s.agua, p.id),
      freqHistorica: p.freqHistorica,
    };
  });
}

/** Características fixas dos pontos (sensibilidade, lixo...). Só para testes e ajustes. */
export const PONTOS_BASE = BASE;
