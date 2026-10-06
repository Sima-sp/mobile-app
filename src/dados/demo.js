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
//   2. O clima define uma INTENSIDADE de 0 a 1. Dela e da sensibilidade do ponto saem a chuva em
//      milímetros, o nível da água no bueiro e uma primeira chance de alagar (só chuva e lugar).
//   3. A LEITURA DO SENSOR ENTRA NA CHANCE: água acima da metade e lixo acima de 30 % (com chuva)
//      multiplicam a chance. O sensor não é só um medidor: ele faz parte da previsão.
//      Os pesos são uma regra do grupo, não algo aprendido (ver chanceComSensor, abaixo).
//   4. A chance final vira nível pelos limiares reais do modelo v1 (médio a partir de 0,41 %,
//      alto a partir de 1,19 %, crítico a partir de 25 %). Água em 100 % é "transbordando agora":
//      crítico, e aí é medição, não previsão.
//
// DIFERENÇA PARA O SERVIÇO DE IA DE HOJE (ml-service v1): lá o modelo calcula a chance só com a
// chuva e o lugar, e a leitura do sensor sobe o NÍVEL por regra, sem mexer na porcentagem. Aqui a
// leitura entra na própria chance, que é o desenho que o projeto quer. Está no README.
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

/**
 * Quanto um lugar reage à chuva, de 0 a 1: pesa o histórico de alagamentos (por ano, perto do
 * ponto) e a distância ao córrego mais próximo. `acaso` (0 a 1) é a parte que os dois não
 * explicam; cada ponto da demonstração tem a sua, fixa.
 */
export function sensibilidadeDoLugar(freqHistorica, distCorrego, acaso = 0.5) {
  const historico = Math.min(1, Math.log1p(freqHistorica) / Math.log1p(12));
  const pertoDoCorrego = Math.exp(-distCorrego / 150);
  return limitar(0.62 * historico + 0.26 * pertoDoCorrego + 0.12 * acaso, 0, 1);
}

// Posição de cada ponto na travessia da chuva (0 = primeiro a ser atingido, 1 = último).
const LONS = PONTOS_CAPITAL.map((p) => p.lon);
const LATS = PONTOS_CAPITAL.map((p) => p.lat);
const [LON_MIN, LON_MAX] = [Math.min(...LONS), Math.max(...LONS)];
const [LAT_MIN, LAT_MAX] = [Math.min(...LATS), Math.max(...LATS)];

/** Características fixas de cada ponto, calculadas uma vez. */
const BASE = PONTOS_CAPITAL.map((p) => {
  return {
    ...p,
    sensibilidade: sensibilidadeDoLugar(p.freqHistorica, p.distCorrego, fixo(p.id, 1)),
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
 * É a chance SÓ pela chuva e pelo lugar; a leitura do sensor entra depois (chanceComSensor).
 * A tabela foi escolhida para, somada ao sensor, dar uma cidade plausível: com chuva forte, de
 * tudo um pouco; com chuva extrema, quase todos acima de médio. Entre uma linha e outra a chance
 * cresce em escala logarítmica, como as probabilidades do modelo de verdade.
 */
const PRESSAO_PARA_CHANCE = [
  [0, 0.0007],
  [0.33, LIMIARES.medio],
  [0.6, LIMIARES.alto],
  [0.72, 0.1],
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

/** Milímetros de chuva nas últimas 3 horas para uma força de chuva de 0 a 1 (ou pouco mais). */
export function chuvaEm3h(forca) {
  return Math.round(66 * forca ** 2.2 * 10) / 10;
}

/**
 * A parte do MODELO: chance de alagar pela chuva e pelo lugar, e o nível que sai dela.
 * As leituras do sensor não entram aqui, como no sistema de verdade.
 * @param {number} forca          chuva no lugar, de 0 (seco) a 1 (temporal)
 * @param {number} sensibilidade  quanto o lugar reage à chuva (sensibilidadeDoLugar)
 */
export function previsaoPelaChuva(forca, sensibilidade) {
  // "Pressão" sobre o bueiro: a chuva pesada pelo quanto o lugar é sensível a ela.
  const pressao = limitar(forca * (0.15 + 0.85 * sensibilidade), 0, 1.2);
  const probabilidade = chancePelaPressao(pressao);
  return { pressao, probabilidade, nivelModelo: nivelPelaChance(probabilidade) };
}

/**
 * Quantas vezes a leitura de ÁGUA multiplica a chance. Bueiro até a metade não muda nada; daí
 * para cima a chance cresce cada vez mais depressa: 2 vezes em 65 %, 6 vezes em 80 % e 12 vezes
 * quando está quase cheio. Nunca diminui a chance.
 */
const AGUA_PARA_FATOR = [[50, 1], [65, 2], [80, 6], [99, 12]];
export function fatorDaAgua(agua) {
  return interpolarFator(AGUA_PARA_FATOR, agua ?? 0);
}

/**
 * Quantas vezes a leitura de LIXO multiplica a chance. Só pesa quando chove (com muito lixo a
 * água escoa pior): de 30 % para cima, 3 vezes em 60 % e 5 vezes com o bueiro todo tomado.
 */
const LIXO_PARA_FATOR = [[30, 1], [60, 3], [100, 5]];
export function fatorDoLixo(lixo, chuvaRecente3h) {
  if (!(chuvaRecente3h >= 0.5)) return 1;
  return interpolarFator(LIXO_PARA_FATOR, lixo ?? 0);
}

/** Lê uma tabela [leitura, fator]; entre uma linha e outra o fator cresce em escala logarítmica. */
function interpolarFator(tabela, valor) {
  if (valor <= tabela[0][0]) return tabela[0][1];
  for (let i = 1; i < tabela.length; i += 1) {
    const [x0, f0] = tabela[i - 1];
    const [x1, f1] = tabela[i];
    if (valor <= x1) return Math.exp(Math.log(f0) + (Math.log(f1) - Math.log(f0)) * ((valor - x0) / (x1 - x0)));
  }
  return tabela[tabela.length - 1][1];
}

/**
 * A parte do SENSOR: a leitura do bueiro entra na conta da chance.
 * A chance que saiu da chuva e do lugar é multiplicada pelo que o sensor mostra (água e lixo),
 * como quem atualiza um palpite ao receber uma evidência nova. A conta é feita em "chances contra
 * e a favor" (odds), para o resultado nunca passar de 100 %.
 *
 * Os pesos (as tabelas acima) são uma REGRA escolhida pelo grupo, não algo que a IA aprendeu:
 * ainda não existe histórico de leituras de sensor para treinar. Quando existir, é este o ponto
 * que o treino substitui. Ver "O sensor na previsão", no README.
 *
 * @returns {{ probabilidade: number, fatorAgua: number, fatorLixo: number }}
 */
export function chanceComSensor(chancePelaChuva, { agua, lixo, chuvaRecente3h }) {
  const fatorAgua = fatorDaAgua(agua);
  const fatorLixo = fatorDoLixo(lixo, chuvaRecente3h);
  // Leituras baixas (ou sensor sem leitura): a chance da chuva e do lugar passa sem mudança.
  if (fatorAgua === 1 && fatorLixo === 1) return { probabilidade: chancePelaChuva, fatorAgua, fatorLixo };
  const odds = (chancePelaChuva / (1 - chancePelaChuva)) * fatorAgua * fatorLixo;
  return { probabilidade: odds / (1 + odds), fatorAgua, fatorLixo };
}

/**
 * A previsão completa de um bueiro: chuva e lugar (previsaoPelaChuva) mais a leitura do sensor
 * (chanceComSensor). O nível sai da chance final pelos limiares do modelo. Água em 100 % é
 * "transbordando agora": aí é medição, e o nível é crítico.
 * @returns {{ probabilidade, probabilidadeSemSensor, nivelModelo, nivel, medicaoTransbordando, fatorAgua, fatorLixo }}
 *   nivelModelo é o nível que a chuva e o lugar dariam sozinhos, sem o sensor
 */
export function preverComSensor(chancePelaChuva, leitura) {
  const { probabilidade, fatorAgua, fatorLixo } = chanceComSensor(chancePelaChuva, leitura);
  const medicaoTransbordando = leitura.agua >= 100;
  return {
    probabilidade,
    probabilidadeSemSensor: chancePelaChuva,
    nivelModelo: nivelPelaChance(chancePelaChuva),
    nivel: medicaoTransbordando ? 4 : nivelPelaChance(probabilidade),
    medicaoTransbordando,
    fatorAgua,
    fatorLixo,
  };
}

/** Leituras e previsão de um ponto para uma intensidade de chuva. Exportada para os testes. */
export function situacaoDoPonto(p, intensidade) {
  const forca = intensidade * p.manchaDeChuva;
  const { pressao, probabilidade: chancePelaChuva } = previsaoPelaChuva(forca, p.sensibilidade);

  const chuvaRecente3h = chuvaEm3h(forca);
  const chuvaPrevista3h = Math.round(31 * forca ** 1.8 * 10) / 10;
  // A água no bueiro sobe com a mesma pressão e um pouco mais onde há muito lixo (escoa pior).
  const agua = Math.round(limitar(p.aguaSeca + 122 * (pressao + 0.05 * forca * (p.lixo / 100)) ** 1.36, 0, 100));
  const previsao = preverComSensor(chancePelaChuva, { agua, lixo: p.lixo, chuvaRecente3h });

  return { chuvaRecente3h, chuvaPrevista3h, agua, ...previsao };
}

/**
 * Simulador da tela "Como a IA funciona": a pessoa escolhe a chuva, o lugar e as leituras do
 * sensor, e recebe o que o sistema responderia. É a mesma conta da demonstração.
 * @param {{ chuva: number, sensibilidade: number, agua: number, lixo: number }} entrada
 *   chuva de 0 a 1; água e lixo em %
 */
export function simularPrevisao({ chuva, sensibilidade, agua, lixo }) {
  const chuvaRecente3h = chuvaEm3h(chuva);
  const { probabilidade: chancePelaChuva } = previsaoPelaChuva(chuva, sensibilidade);
  return { chuvaRecente3h, ...preverComSensor(chancePelaChuva, { agua, lixo, chuvaRecente3h }) };
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
      probabilidadeSemSensor: s.probabilidadeSemSensor,
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
