// A regra da tela de viagem: dado o caminho da rota e quanto dele já foi percorrido, diz onde o
// carro está, para onde aponta, qual é a próxima manobra e quanto falta.
//
// A viagem é medida em METROS PERCORRIDOS desde a partida. Quem faz o carro andar é a tela
// (src/telas/Viagem.jsx); este arquivo só faz as contas, sem tela e sem internet, e por isso é
// testado em viagem.test.js.
//
// As manobras vêm do serviço de rotas (Valhalla), em src/rotas/servico.js. Cada uma acontece no
// ponto `inicio` do caminho: "vire à direita na Rua X" vale para aquele ponto, e a rua é a via em
// que se entra.

import { metros } from "./geometria.js";

/**
 * O que cada tipo de manobra do Valhalla vira na tela: a seta desenhada e a frase curta.
 * Tipos que não estão aqui (balsa, transporte público) usam a frase pronta do serviço.
 */
const TIPOS = {
  1: ["frente", "Siga em frente"], 2: ["frente", "Siga em frente"], 3: ["frente", "Siga em frente"],
  4: ["chegada", "Chegada"], 5: ["chegada", "Chegada à direita"], 6: ["chegada", "Chegada à esquerda"],
  7: ["frente", "Continue"], 8: ["frente", "Continue"],
  9: ["leve-direita", "Vire levemente à direita"], 10: ["direita", "Vire à direita"], 11: ["fechada-direita", "Curva fechada à direita"],
  12: ["retorno", "Faça o retorno"], 13: ["retorno", "Faça o retorno"],
  14: ["fechada-esquerda", "Curva fechada à esquerda"], 15: ["esquerda", "Vire à esquerda"], 16: ["leve-esquerda", "Vire levemente à esquerda"],
  17: ["frente", "Siga pelo acesso"], 18: ["leve-direita", "Pegue o acesso à direita"], 19: ["leve-esquerda", "Pegue o acesso à esquerda"],
  20: ["leve-direita", "Pegue a saída à direita"], 21: ["leve-esquerda", "Pegue a saída à esquerda"],
  22: ["frente", "Siga em frente"], 23: ["leve-direita", "Mantenha-se à direita"], 24: ["leve-esquerda", "Mantenha-se à esquerda"],
  25: ["frente", "Entre na via"], 26: ["rotatoria", "Entre na rotatória"], 27: ["rotatoria", "Saia da rotatória"],
  37: ["leve-direita", "Entre na via pela direita"], 38: ["leve-esquerda", "Entre na via pela esquerda"],
};

/**
 * Como dizer uma manobra na faixa do alto da tela.
 * @returns {{ seta: string, frase: string, rua: string }}  `seta` é o nome do desenho (ver IconeManobra)
 */
export function descreverManobra(manobra) {
  const [seta, frase] = TIPOS[manobra.tipo] ?? ["frente", manobra.texto || "Siga em frente"];
  if (manobra.tipo === 26 && manobra.saida) return { seta, frase: `Na rotatória, pegue a ${manobra.saida}ª saída`, rua: manobra.rua };
  return { seta, frase, rua: manobra.rua };
}

/** Para que lado o caminho aponta de `a` para `b`, em graus: 0 é norte, 90 é leste. */
export function rumoEntre([lonA, latA], [lonB, latB]) {
  const x = (lonB - lonA) * Math.cos(((latA + latB) / 2) * (Math.PI / 180));
  const y = latB - latA;
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

/** O menor giro, em graus, para ir de um rumo a outro (de -180 a 180). */
export function giro(de, para) {
  return ((((para - de) % 360) + 540) % 360) - 180;
}

/**
 * Prepara a rota para a viagem: mede o caminho ponto a ponto e marca em que metro cada manobra
 * acontece. É feito uma vez só, ao começar.
 *
 * @param {{ caminho: Array<[number, number]>, minutos: number, manobras?: Array }} rota
 * @returns {{ caminho, acumulado: number[], metros: number, segundos: number, manobras: Array }}
 *   Em cada manobra entram `metro` (onde ela acontece) e `faltam` (segundos de viagem dali até o fim).
 */
export function prepararViagem(rota) {
  const caminho = rota.caminho;
  const acumulado = [0];
  for (let i = 1; i < caminho.length; i++) acumulado.push(acumulado[i - 1] + metros(caminho[i - 1], caminho[i]));
  const total = acumulado[acumulado.length - 1] ?? 0;
  const ultimo = caminho.length - 1;

  let manobras = (rota.manobras ?? [])
    .map((m) => ({ ...m, metro: acumulado[Math.min(Math.max(m.inicio ?? 0, 0), ultimo)] ?? 0 }))
    .sort((a, b) => a.metro - b.metro);
  // Sem passo a passo (não deveria acontecer), a viagem ainda funciona: partida e chegada.
  if (manobras.length === 0) {
    manobras = [
      { tipo: 1, texto: "", rua: "", segundos: (rota.minutos ?? 0) * 60, metro: 0 },
      { tipo: 4, texto: "", rua: "", segundos: 0, metro: total },
    ];
  }
  // Quanto tempo falta a partir de cada manobra: a soma dos tempos dela em diante.
  let soma = 0;
  for (let i = manobras.length - 1; i >= 0; i--) {
    soma += manobras[i].segundos ?? 0;
    manobras[i].faltam = soma;
  }
  const segundos = soma > 0 ? soma : (rota.minutos ?? 0) * 60;
  return { caminho, acumulado, metros: total, segundos, manobras };
}

/** Em que trecho do caminho está o metro pedido (busca binária): índice do ponto anterior. */
function trechoDoMetro(viagem, metro) {
  const { acumulado } = viagem;
  let baixo = 0;
  let alto = acumulado.length - 1;
  while (alto - baixo > 1) {
    const meio = (baixo + alto) >> 1;
    if (acumulado[meio] <= metro) baixo = meio;
    else alto = meio;
  }
  return baixo;
}

/**
 * O ponto do caminho que fica a `metro` metros da partida.
 * @returns {[number, number]} [lon, lat]
 */
export function pontoNoMetro(viagem, metro) {
  const { caminho, acumulado } = viagem;
  if (caminho.length === 1) return caminho[0];
  const m = Math.min(Math.max(metro, 0), viagem.metros);
  const i = trechoDoMetro(viagem, m);
  const tamanho = acumulado[i + 1] - acumulado[i];
  const t = tamanho > 0 ? (m - acumulado[i]) / tamanho : 0;
  const [a, b] = [caminho[i], caminho[i + 1]];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Para onde o carro aponta num ponto da viagem. Olha um pouco à frente (`adiante` metros) em vez
 * de usar só o trecho atual: assim a seta gira nas curvas em vez de dar um tranco em cada vértice.
 */
export function rumoNoMetro(viagem, metro, adiante = 18) {
  const de = Math.min(Math.max(metro, 0), Math.max(0, viagem.metros - 1));
  const ate = Math.min(viagem.metros, de + adiante);
  const [a, b] = [pontoNoMetro(viagem, de), pontoNoMetro(viagem, ate)];
  if (a[0] === b[0] && a[1] === b[1]) {
    // No fim do caminho não há "à frente": usa o último trecho que tem tamanho.
    for (let i = viagem.caminho.length - 1; i > 0; i--) {
      if (viagem.acumulado[i] > viagem.acumulado[i - 1]) return rumoEntre(viagem.caminho[i - 1], viagem.caminho[i]);
    }
    return 0;
  }
  return rumoEntre(a, b);
}

/** O pedaço do caminho que ainda falta percorrer, começando onde o carro está. */
export function caminhoQueFalta(viagem, metro) {
  const m = Math.min(Math.max(metro, 0), viagem.metros);
  const i = trechoDoMetro(viagem, m);
  return [pontoNoMetro(viagem, m), ...viagem.caminho.slice(i + 1)];
}

/**
 * A situação da viagem depois de `metro` metros percorridos.
 *
 * @returns {{
 *   ponto: [number, number], rumo: number, chegou: boolean,
 *   proxima: object, ateProxima: number,   a próxima manobra e quantos metros faltam até ela
 *   seguinte: object|null,                 a manobra depois da próxima (para "depois, vire…")
 *   ruaAtual: string,
 *   restanteMetros: number, restanteSegundos: number,
 * }}
 */
export function situacaoDaViagem(viagem, metro) {
  const m = Math.min(Math.max(metro, 0), viagem.metros);
  const { manobras } = viagem;
  // A manobra em que o carro está: a última que já ficou para trás (ou a primeira).
  let atual = 0;
  for (let i = 0; i < manobras.length; i++) {
    if (manobras[i].metro <= m + 0.5) atual = i;
    else break;
  }
  const chegou = m >= viagem.metros - 0.5;
  const indiceProxima = Math.min(atual + 1, manobras.length - 1);
  const proxima = manobras[indiceProxima];
  const seguinte = manobras[indiceProxima + 1] ?? null;

  // Tempo que falta: o resto do trecho atual (na proporção do que já andou nele) e os seguintes.
  const fimDoTrecho = indiceProxima > atual ? proxima.metro : viagem.metros;
  const tamanho = fimDoTrecho - manobras[atual].metro;
  const andado = tamanho > 0 ? Math.min(1, (m - manobras[atual].metro) / tamanho) : 1;
  const depois = indiceProxima > atual ? proxima.faltam : 0;
  const restanteSegundos = chegou ? 0 : (manobras[atual].segundos ?? 0) * (1 - andado) + depois;

  return {
    ponto: pontoNoMetro(viagem, m),
    rumo: rumoNoMetro(viagem, m),
    chegou,
    proxima,
    ateProxima: Math.max(0, proxima.metro - m),
    seguinte,
    ruaAtual: manobras[atual].rua ?? "",
    restanteMetros: Math.max(0, viagem.metros - m),
    restanteSegundos,
  };
}

/* ───────────── Como a viagem é dita na tela ───────────── */

/** Distância até a manobra, arredondada como nos apps de navegação: "agora", "80 m", "350 m", "1,2 km". */
export function textoAteManobra(m) {
  if (m < 15) return "agora";
  if (m < 100) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 1000) return `${Math.round(m / 50) * 50} m`.replace(/^1000 m$/, "1 km");
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: m < 10000 ? 1 : 0 }).format(m / 1000)} km`;
}

/** Hora de chegada no relógio: "14:32". */
export function horaDeChegada(agora, segundosRestantes) {
  const chegada = new Date(agora.getTime() + segundosRestantes * 1000);
  return `${String(chegada.getHours()).padStart(2, "0")}:${String(chegada.getMinutes()).padStart(2, "0")}`;
}
