// Testes da regra das rotas, sem internet: o "serviço" é uma função de mentira.
// Rodar com: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { decodificarPolilinha, distanciaAteCaminho, metros, perimetro, quadradoEmVolta } from "./geometria.js";
import {
  REGRAS, assinaturaDoRisco, escolherAreas, noCaminho, planejarRota, pontosEmRisco, resumoDaRota, textoDistancia, textoDuracao,
  viasPrincipais,
} from "./planejar.js";

const AGORA = new Date("2026-10-06T16:00:00Z");
const bueiro = (id, lon, lat, nivel, extra = {}) => ({ id, codigo: `X-${id}`, lon, lat, nivel, status: "VALIDA", validaAte: null, ...extra });

// Uma avenida reta de oeste para leste e um desvio que sobe um quarteirão.
const ORIGEM = [-46.66, -23.55];
const DESTINO = [-46.62, -23.55];
const RETA = [ORIGEM, [-46.65, -23.55], [-46.64, -23.55], [-46.63, -23.55], DESTINO];
const POR_CIMA = [ORIGEM, [-46.655, -23.546], [-46.64, -23.546], [-46.625, -23.546], DESTINO];

test("polilinha: decodifica o exemplo conhecido (5 casas) e o formato do serviço (6 casas)", () => {
  // Exemplo da documentação do algoritmo: (38.5,-120.2), (40.7,-120.95), (43.252,-126.453)
  assert.deepEqual(decodificarPolilinha("_p~iF~ps|U_ulLnnqC_mqNvxq`@", 5), [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
  const seis = decodificarPolilinha("~ps|U_p~iF", 6); // um ponto só
  assert.equal(seis.length, 1);
});

test("distâncias: metros entre pontos e de um ponto até o caminho", () => {
  // 0,01 grau de longitude na latitude de São Paulo dá perto de 1 km.
  assert.ok(Math.abs(metros([-46.64, -23.55], [-46.63, -23.55]) - 1020) < 15);
  // Ponto 0,0003 grau (~33 m) ao norte da avenida.
  const d = distanciaAteCaminho([-46.645, -23.5497], RETA);
  assert.ok(d > 30 && d < 36, `distância ${d}`);
  // Antes do começo do caminho, vale a distância até a ponta.
  assert.ok(Math.abs(distanciaAteCaminho([-46.67, -23.55], RETA) - 1020) < 15);
  assert.equal(distanciaAteCaminho([-46.6, -23.5], []), Infinity);
});

test("área a evitar: quadrado fechado, com folga sobre a distância 'no caminho'", () => {
  const anel = quadradoEmVolta([-46.64, -23.55], REGRAS.folgaDaArea);
  assert.equal(anel.length, 5);
  assert.deepEqual(anel[0], anel[4]);
  const p = perimetro(anel);
  assert.ok(Math.abs(p - 8 * REGRAS.folgaDaArea) < 3, `perímetro ${p}`);
  // Os lados ficam mais longe do bueiro do que a distância que conta como "no caminho".
  assert.ok(REGRAS.folgaDaArea > REGRAS.distanciaNoCaminho);
  assert.ok(Math.abs(distanciaAteCaminho([-46.64, -23.55], anel) - REGRAS.folgaDaArea) < 1);
});

test("em risco: alto, crítico e transbordando; previsão ausente não entra", () => {
  const pontos = [bueiro("1", 0, 0, 1), bueiro("2", 0, 0, 2), bueiro("3", 0, 0, 3), bueiro("4", 0, 0, 4),
    bueiro("5", 0, 0, 2, { medicaoTransbordando: true }), bueiro("6", 0, 0, null, { status: "SEM_PREVISAO" })];
  assert.deepEqual(pontosEmRisco(pontos, AGORA).map((p) => p.id), ["3", "4", "5"]);
  assert.equal(assinaturaDoRisco(pontos, AGORA), "3,4,5");
});

test("áreas: mais próximos do caminho primeiro, colados na partida ficam de fora, respeita os limites do serviço", () => {
  const perto = bueiro("perto", -46.64, -23.55, 4);
  const longe = bueiro("longe", -46.64, -23.58, 4);
  const naPartida = bueiro("partida", -46.66, -23.5501, 4);
  const { areas, incluidos, colados } = escolherAreas([longe, naPartida, perto], [RETA], { origem: ORIGEM, destino: DESTINO });
  assert.deepEqual([...incluidos], ["perto", "longe"]);
  assert.equal(areas.length, 2);
  assert.deepEqual(colados.map((p) => p.id), ["partida"]);
  // Com muitos bueiros, para antes de estourar o limite do serviço.
  const muitos = Array.from({ length: 80 }, (_, i) => bueiro(`m${i}`, -46.65 + i * 0.0005, -23.56, 3));
  const cheio = escolherAreas(muitos, [RETA], { origem: ORIGEM, destino: DESTINO });
  const total = cheio.areas.reduce((soma, a) => soma + perimetro(a), 0);
  const vertices = cheio.areas.reduce((soma, a) => soma + a.length, 0);
  assert.equal(cheio.areas.length, 20); // 100 vértices, 5 por quadrado
  assert.ok(vertices <= REGRAS.verticesMaximos && total <= REGRAS.perimetroMaximo, `${vertices} vértices, ${total} m`);
});

test("planejar: caminho livre não pede desvio", async () => {
  let pedidos = 0;
  const pedirRota = async () => { pedidos++; return { caminho: RETA, minutos: 10, km: 4, trechos: [] }; };
  const r = await planejarRota({ origem: ORIGEM, destino: DESTINO, pontos: [bueiro("1", -46.64, -23.55, 1), bueiro("2", -46.64, -23.58, 4)], agora: AGORA, pedirRota });
  assert.equal(r.situacao, "livre");
  assert.equal(r.segura, r.rapida);
  assert.equal(pedidos, 1);
  assert.equal(resumoDaRota(r).titulo, "Caminho livre");
});

test("planejar: bueiro crítico na avenida gera desvio e o resumo diz o custo", async () => {
  const areasPedidas = [];
  const pedirRota = async (areas) => {
    areasPedidas.push(areas.length);
    return areas.length ? { caminho: POR_CIMA, minutos: 13.4, km: 4.6, trechos: [] } : { caminho: RETA, minutos: 10, km: 4, trechos: [] };
  };
  const pontos = [bueiro("7", -46.64, -23.5501, 4), bueiro("8", -46.63, -23.5499, 3), bueiro("9", -46.7, -23.6, 4)];
  const r = await planejarRota({ origem: ORIGEM, destino: DESTINO, pontos, agora: AGORA, pedirRota });
  assert.equal(r.situacao, "desvia");
  assert.deepEqual(r.rapida.emRisco.map((p) => p.id), ["7", "8"]);
  assert.equal(r.segura.emRisco.length, 0);
  assert.deepEqual(areasPedidas, [0, 3]); // todos os em risco cabem no perímetro
  const resumo = resumoDaRota(r);
  assert.equal(resumo.titulo, "Rota segura");
  assert.equal(resumo.situacao, "Desvia de 2 bueiros em risco");
  assert.equal(resumo.comparacao, "3 min a mais que o caminho mais rápido.");
  assert.equal(resumoDaRota(r, "rapida").situacao, "Passa por 2 bueiros em risco: X-7, X-8");
  // O caminho mais rápido já traçado é reaproveitado.
  await planejarRota({ origem: ORIGEM, destino: DESTINO, pontos, agora: AGORA, pedirRota, rapidaPronta: r.rapida });
  assert.deepEqual(areasPedidas, [0, 3, 3]);
});

test("planejar: sem caminho alternativo, fica o mais rápido com aviso", async () => {
  const pedirRota = async (areas) => {
    if (areas.length) throw Object.assign(new Error("No path could be found"), { tipo: "sem-caminho" });
    return { caminho: RETA, minutos: 10, km: 4, trechos: [] };
  };
  const r = await planejarRota({ origem: ORIGEM, destino: DESTINO, pontos: [bueiro("7", -46.64, -23.55, 4)], agora: AGORA, pedirRota });
  assert.equal(r.situacao, "sem-desvio");
  assert.equal(r.segura, null);
  assert.equal(resumoDaRota(r).tom, 4);
});

test("planejar: bueiro colado na chegada não tem como evitar; desvio que não melhora é descartado", async () => {
  const soReta = async () => ({ caminho: RETA, minutos: 10, km: 4, trechos: [] });
  const colado = await planejarRota({ origem: ORIGEM, destino: DESTINO, pontos: [bueiro("7", -46.6201, -23.55, 4)], agora: AGORA, pedirRota: soReta });
  assert.equal(colado.situacao, "sem-desvio");
  const naoMelhora = await planejarRota({ origem: ORIGEM, destino: DESTINO, pontos: [bueiro("7", -46.64, -23.55, 4)], agora: AGORA, pedirRota: soReta });
  assert.equal(naoMelhora.situacao, "sem-desvio");
});

test("planejar: desvio que esbarra em outro bueiro tenta de novo; o que sobra vira 'parcial'", async () => {
  // 45 bueiros em risco: nem todos cabem nas áreas. O desvio passa por um que ficou de fora.
  const fila = Array.from({ length: 44 }, (_, i) => bueiro(`f${i}`, -46.659 + i * 0.0008, -23.553, 3));
  const naAvenida = bueiro("a", -46.64, -23.55, 4);
  const noDesvio = bueiro("d", -46.64, -23.546, 4);
  let pedidos = 0;
  const pedirRota = async (areas) => { pedidos++; return areas.length ? { caminho: POR_CIMA, minutos: 14, km: 4.6, trechos: [] } : { caminho: RETA, minutos: 10, km: 4, trechos: [] }; };
  const r = await planejarRota({ origem: ORIGEM, destino: DESTINO, pontos: [...fila, naAvenida, noDesvio], agora: AGORA, pedirRota });
  // Mais rápida + primeiro desvio (esbarra em "d", que tinha ficado de fora) + segundo desvio com "d" incluído.
  assert.equal(pedidos, 3);
  // O serviço de mentira sempre devolve o mesmo desvio, que passa por "d": troca um bueiro por outro e não melhora.
  assert.equal(r.situacao, "sem-desvio");
});

test("textos: duração, distância e vias principais", () => {
  assert.equal(textoDuracao(0.4), "1 min");
  assert.equal(textoDuracao(16.6), "17 min");
  assert.equal(textoDuracao(65), "1 h 05");
  assert.equal(textoDistancia(0.84), "840 m");
  assert.equal(textoDistancia(6.79), "6,8 km");
  assert.equal(textoDistancia(23.4), "23 km");
  const trechos = [{ nome: "Rua A", km: 0.2 }, { nome: "Av. Tiradentes", km: 2.1 }, { nome: "", km: 0.3 }, { nome: "Rua B", km: 0.4 }, { nome: "Av. Paulista", km: 1.5 }, { nome: "Av. Tiradentes", km: 0.4 }];
  assert.deepEqual(viasPrincipais(trechos), ["Av. Tiradentes", "Av. Paulista"]);
  assert.deepEqual(viasPrincipais([]), []);
});

test("noCaminho usa a distância combinada", () => {
  const a = bueiro("a", -46.645, -23.5497, 4); // ~33 m
  const b = bueiro("b", -46.645, -23.5495, 4); // ~55 m
  assert.deepEqual(noCaminho(RETA, [a, b]).map((p) => p.id), ["a"]);
});
