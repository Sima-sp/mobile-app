// A regra das rotas do SIMA: ir de carro de um lugar a outro desviando dos bueiros em risco.
//
// Como funciona:
// 1. Pede ao serviço de rotas o caminho mais rápido, sem restrição nenhuma.
// 2. Vê quais bueiros em risco (nível alto, crítico ou transbordando) ficam em cima desse caminho.
// 3. Se não há nenhum, o caminho mais rápido já é o seguro.
// 4. Se há, pede outro caminho mandando um pequeno quadrado em volta de cada bueiro em risco como
//    "área a evitar". O serviço público aceita poucas áreas por pedido (cerca de 20), então
//    entram primeiro os bueiros mais próximos do caminho.
// 5. Confere o caminho novo. Se ele esbarrou num bueiro em risco que tinha ficado de fora,
//    repete, agora priorizando os bueiros próximos de todos os caminhos já achados.
//
// Este arquivo não fala com a internet: quem chama passa a função `pedirRota`. Assim a regra pode
// ser testada sem rede (planejar.test.js) e o serviço pode ser trocado sem mexer aqui.

import { nivelVisivel } from "../dados/modelo.js";
import { distanciaAteCaminho, metros, perimetro, quadradoEmVolta } from "./geometria.js";

export const REGRAS = {
  /** A partir de que nível o bueiro é evitado (3 = alto). */
  nivelMinimo: 3,
  /** Até que distância do caminho, em metros, o bueiro conta como "no caminho". */
  distanciaNoCaminho: 35,
  /** Distância do bueiro até os lados do quadrado a evitar, em metros. Maior que a distância
   *  acima, para o caminho novo não passar raspando. */
  folgaDaArea: 38,
  /** Bueiro colado na partida ou na chegada não dá para evitar: a pessoa precisa ir até lá. */
  distanciaColado: 60,
  /** Limites do servidor público de rotas para as áreas a evitar, medidos em 06/10/2026:
   *  100 vértices no total (cada quadrado conta 5, com o que fecha o anel) e 10 000 m de perímetro. */
  verticesMaximos: 100,
  perimetroMaximo: 9500,
  /** Quantas vezes pedir o caminho com áreas a evitar. */
  tentativas: 3,
};

/** Bueiros que a rota deve evitar: nível alto ou crítico, ou transbordando agora. */
export function pontosEmRisco(pontos, agora = new Date()) {
  return pontos.filter((p) => p.medicaoTransbordando || (nivelVisivel(p, agora) ?? 0) >= REGRAS.nivelMinimo);
}

/** Assinatura do conjunto em risco: muda só quando a lista de bueiros a evitar muda. */
export function assinaturaDoRisco(pontos, agora = new Date()) {
  return pontosEmRisco(pontos, agora).map((p) => p.id).sort().join(",");
}

/** Quais dos bueiros em risco ficam em cima do caminho. */
export function noCaminho(caminho, emRisco, limite = REGRAS.distanciaNoCaminho) {
  return emRisco.filter((p) => distanciaAteCaminho([p.lon, p.lat], caminho) <= limite);
}

/**
 * Escolhe as áreas a evitar: uma em volta de cada bueiro em risco, dos mais próximos do(s)
 * caminho(s) para os mais distantes, até caber nos limites do serviço (vértices e perímetro).
 *
 * @param {Array}  emRisco   bueiros em risco
 * @param {Array}  caminhos  um ou mais caminhos de referência (o mais rápido, e depois o desvio)
 * @param {object} extremos  { origem: [lon, lat], destino: [lon, lat] }
 * @returns {{ areas: Array, incluidos: Set<string>, colados: Array }}
 */
export function escolherAreas(emRisco, caminhos, { origem, destino }) {
  const colados = [];
  const candidatos = [];
  for (const p of emRisco) {
    const lugar = [p.lon, p.lat];
    if (metros(lugar, origem) <= REGRAS.distanciaColado || metros(lugar, destino) <= REGRAS.distanciaColado) {
      colados.push(p);
      continue;
    }
    const distancia = Math.min(...caminhos.map((c) => distanciaAteCaminho(lugar, c)));
    candidatos.push({ ponto: p, distancia });
  }
  candidatos.sort((a, b) => a.distancia - b.distancia);

  const areas = [];
  const incluidos = new Set();
  let total = 0;
  let vertices = 0;
  for (const { ponto } of candidatos) {
    const area = quadradoEmVolta([ponto.lon, ponto.lat], REGRAS.folgaDaArea);
    const tamanho = perimetro(area);
    if (vertices + area.length > REGRAS.verticesMaximos || total + tamanho > REGRAS.perimetroMaximo) break;
    total += tamanho;
    vertices += area.length;
    areas.push(area);
    incluidos.add(ponto.id);
  }
  return { areas, incluidos, colados };
}

/** As duas vias mais longas do trajeto, para dizer "por Av. X e Av. Y". */
export function viasPrincipais(trechos, quantas = 2) {
  const porNome = new Map();
  for (const { nome, km } of trechos ?? []) {
    if (!nome) continue;
    porNome.set(nome, (porNome.get(nome) ?? 0) + km);
  }
  // As mais longas, mas na ordem em que aparecem no trajeto.
  const maiores = new Set([...porNome.entries()].sort((a, b) => b[1] - a[1]).slice(0, quantas).map(([nome]) => nome));
  return [...porNome.keys()].filter((nome) => maiores.has(nome));
}

/**
 * Planeja a rota. Não lança erro quando só o desvio falha: nesse caso devolve o caminho mais
 * rápido com o aviso. Lança o erro do serviço quando nem o caminho mais rápido pôde ser traçado.
 *
 * @param {object}   pedido
 * @param {[number, number]} pedido.origem   [lon, lat]
 * @param {[number, number]} pedido.destino  [lon, lat]
 * @param {Array}    pedido.pontos           bueiros (formato de modelo.js)
 * @param {Date}     [pedido.agora]
 * @param {Function} pedido.pedirRota        async (areas) => { caminho, minutos, km, trechos }
 * @param {object}   [pedido.rapidaPronta]   caminho mais rápido já traçado antes (evita refazer)
 *
 * @returns {Promise<{ situacao: "livre"|"desvia"|"parcial"|"sem-desvio", rapida: object, segura: object|null }>}
 *   livre       o caminho mais rápido não passa por bueiro em risco (segura === rapida)
 *   desvia      há um caminho que evita todos
 *   parcial     o melhor caminho achado ainda passa por algum
 *   sem-desvio  não há caminho alternativo (segura === null)
 *   Em cada rota, `emRisco` lista os bueiros em risco que ficam no caminho.
 */
export async function planejarRota({ origem, destino, pontos, agora = new Date(), pedirRota, rapidaPronta = null }) {
  const risco = pontosEmRisco(pontos, agora);
  const rapidaBruta = rapidaPronta ?? await pedirRota([]);
  const rapida = { ...rapidaBruta, emRisco: noCaminho(rapidaBruta.caminho, risco) };
  if (rapida.emRisco.length === 0) return { situacao: "livre", rapida, segura: rapida };

  const referencia = [rapida.caminho];
  let melhor = null;
  for (let tentativa = 0; tentativa < REGRAS.tentativas; tentativa++) {
    const { areas, incluidos } = escolherAreas(risco, referencia, { origem, destino });
    if (areas.length === 0) break; // tudo o que está no caminho fica colado na partida ou na chegada
    let desvio;
    try {
      desvio = await pedirRota(areas);
    } catch (erro) {
      if (erro?.tipo === "sem-caminho") break;
      if (melhor) break; // já há um desvio; uma falha na segunda tentativa não o invalida
      throw erro;
    }
    const candidata = { ...desvio, emRisco: noCaminho(desvio.caminho, risco) };
    if (!melhor || candidata.emRisco.length < melhor.emRisco.length) melhor = candidata;
    // Esbarrou em bueiro que tinha ficado de fora das áreas? Tenta de novo considerando os dois caminhos.
    const deFora = candidata.emRisco.filter((p) => !incluidos.has(p.id));
    if (deFora.length === 0) break;
    referencia.push(desvio.caminho);
  }

  if (!melhor || melhor.emRisco.length >= rapida.emRisco.length) return { situacao: "sem-desvio", rapida, segura: null };
  return { situacao: melhor.emRisco.length === 0 ? "desvia" : "parcial", rapida, segura: melhor };
}

/* ───────────── Como a rota é dita na tela ───────────── */

/** "17 min", "1 h 05". */
export function textoDuracao(minutos) {
  const total = Math.max(1, Math.round(minutos));
  if (total < 60) return `${total} min`;
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")}`;
}

/** "850 m", "6,8 km", "23 km". */
export function textoDistancia(km) {
  if (km < 1) return `${Math.round((km * 1000) / 10) * 10} m`;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: km < 20 ? 1 : 0 }).format(km)} km`;
}

const bueiros = (n) => (n === 1 ? "1 bueiro em risco" : `${n} bueiros em risco`);

/**
 * Textos do cartão da rota.
 * @param {object} resultado  o que planejarRota devolveu
 * @param {"segura"|"rapida"} escolhida  qual das duas a pessoa está vendo
 * @returns {{ titulo, tom, situacao, comparacao, rota }}  `tom` é o nível de risco da frase
 *   (1 tranquilo, 3 atenção, 4 perigo) e `rota` é a rota que deve ficar em destaque no mapa.
 */
export function resumoDaRota(resultado, escolhida = "segura") {
  const { situacao, rapida, segura } = resultado;
  const codigos = (rota) => rota.emRisco.map((p) => p.codigo).slice(0, 4).join(", ") + (rota.emRisco.length > 4 ? "…" : "");

  if (situacao === "livre") {
    return { titulo: "Caminho livre", tom: 1, rota: rapida, situacao: "Nenhum bueiro em risco no caminho", comparacao: "Este já é o caminho mais rápido." };
  }
  if (situacao === "sem-desvio") {
    return { titulo: "Sem desvio possível", tom: 4, rota: rapida,
      situacao: `Passa por ${bueiros(rapida.emRisco.length)}: ${codigos(rapida)}`,
      comparacao: "Não há outro trajeto que evite esses pontos. Se puder, espere a chuva passar." };
  }
  if (escolhida === "rapida") {
    return { titulo: "Caminho mais rápido", tom: 4, rota: rapida,
      situacao: `Passa por ${bueiros(rapida.emRisco.length)}: ${codigos(rapida)}`,
      comparacao: "Mais curto, mas atravessa pontos com risco de alagar." };
  }
  // A diferença usa os minutos já arredondados, para bater com os tempos mostrados nos botões.
  const aMais = Math.round(segura.minutos) - Math.round(rapida.minutos);
  const custo = aMais >= 1 ? `${textoDuracao(aMais)} a mais que o caminho mais rápido.` : "Leva praticamente o mesmo tempo que o caminho mais rápido.";
  if (situacao === "parcial") {
    return { titulo: "Rota com menos risco", tom: 3, rota: segura,
      situacao: `Ainda passa por ${bueiros(segura.emRisco.length)}: ${codigos(segura)}`,
      comparacao: `Evita ${rapida.emRisco.length - segura.emRisco.length} de ${rapida.emRisco.length} pontos. ${custo}` };
  }
  return { titulo: "Rota segura", tom: 1, rota: segura, situacao: `Desvia de ${bueiros(rapida.emRisco.length)}`, comparacao: custo };
}
