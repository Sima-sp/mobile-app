// Testes da regra que escolhe o trecho de rua de cada bueiro. Rodar com: npm test

import test from "node:test";
import assert from "node:assert/strict";
import {
  REGRAS_RUAS, consultaDasVias, emendar, mesmoNome, palavrasDoNome, recortarNoCirculo, simplificar, somaDeVerificacao, textoDoArquivo,
  trechoDoPonto, viasDaResposta,
} from "./ruas-nucleo.mjs";

// Um ponto no centro de São Paulo e ruas retas em volta dele (1 grau de latitude ≈ 111 km).
const PONTO = { lat: -23.55, lon: -46.63, endereco: "Av. do Estado" };
const GRAU = 111320;
const lat = (m) => PONTO.lat + m / GRAU;
const lon = (m) => PONTO.lon + m / (GRAU * Math.cos((PONTO.lat * Math.PI) / 180));
/** Rua de leste a oeste, `norte` metros ao norte do ponto, de `de` a `ate` metros a leste dele. */
const rua = (id, nome, norte, de = -600, ate = 600) => ({ id, nome, geometria: [[lon(de), lat(norte)], [lon(ate), lat(norte)]] });
const COS = Math.cos((PONTO.lat * Math.PI) / 180);
/** Comprimento, em metros, de uma linha guardada em passos a partir do ponto. */
const comprimento = (linha) => {
  let total = 0;
  for (let i = 2; i < linha.length; i += 2) total += Math.hypot((linha[i] - linha[i - 2]) * COS, linha[i + 1] - linha[i - 1]);
  return total * REGRAS_RUAS.passo * GRAU;
};

test("o nome do endereço é comparado sem acento, abreviação nem tipo de via", () => {
  assert.deepEqual(palavrasDoNome("Av. do Estado"), ["estado"]);
  assert.deepEqual(palavrasDoNome("Elevado Pres. João Goulart"), ["joao", "goulart"]);
  assert.ok(mesmoNome("R. Pres. Batista Pereira", "Rua Presidente Batista Pereira"));
  assert.ok(mesmoNome("Marginal Tietê", "Avenida Marginal Direita do Tietê"));
  assert.ok(!mesmoNome("Av. do Estado", "Rua da Mooca"));
  assert.ok(!mesmoNome("", "Rua da Mooca"));
  assert.ok(!mesmoNome("Av. do Estado", null));
});

test("o recorte fica só com o que está dentro do círculo", () => {
  const dentro = recortarNoCirculo([[-400, 10], [400, 10]], 150);
  assert.equal(dentro.length, 1);
  assert.ok(Math.abs(Math.hypot(...dentro[0][0]) - 150) < 0.01 && Math.abs(Math.hypot(...dentro[0][1]) - 150) < 0.01);
  assert.deepEqual(recortarNoCirculo([[-400, 200], [400, 200]], 150), [], "rua que passa por fora não entra");
  const zigue = recortarNoCirculo([[-300, 0], [0, 0], [0, 300], [20, 300], [20, 0], [300, 0]], 150);
  assert.equal(zigue.length, 2, "rua que sai e volta vira dois pedaços");
});

test("a simplificação tira vértices em linha reta e mantém as curvas", () => {
  assert.deepEqual(simplificar([[0, 0], [50, 0.5], [100, 0]], 2), [[0, 0], [100, 0]]);
  assert.equal(simplificar([[0, 0], [50, 30], [100, 0]], 2).length, 3);
});

test("pedaços que se encostam viram uma linha só, em qualquer ordem e sentido", () => {
  const juntos = emendar([[[0, 0], [10, 0]], [[30, 0], [20, 0]], [[10, 0], [20, 0]]], 0.6);
  assert.equal(juntos.length, 1);
  assert.deepEqual([juntos[0][0], juntos[0][juntos[0].length - 1]].sort((a, b) => a[0] - b[0]), [[0, 0], [30, 0]]);
  assert.equal(juntos[0].length, 4, "sem vértice repetido na emenda");
  assert.equal(emendar([[[0, 0], [10, 0]], [[50, 0], [60, 0]]], 0.6).length, 2, "pedaços afastados continuam separados");
  // Entroncamento: três pontas no mesmo lugar dão duas linhas.
  assert.equal(emendar([[[0, 0], [10, 0]], [[10, 0], [20, 0]], [[10, 0], [10, 10]]], 0.6).length, 2);
});

test("a rua com o nome do endereço ganha da mais próxima", () => {
  const vias = [rua(1, "Rua da Mooca", 8), rua(2, "Avenida do Estado", 40)];
  const r = trechoDoPonto(PONTO, vias);
  assert.equal(r.via, "Avenida do Estado");
  assert.equal(r.pelaNome, true);
  assert.equal(r.linhas.length, 1);
});

test("sem o nome por perto, vale a via mais próxima", () => {
  const vias = [rua(1, "Rua da Mooca", 8), rua(2, "Avenida do Estado", 120)];
  const r = trechoDoPonto(PONTO, vias);
  assert.equal(r.via, "Rua da Mooca");
  assert.equal(r.pelaNome, false);
});

test("entram a continuação da rua e a pista do outro sentido; o trecho tem cerca de 300 m para cada lado", () => {
  const vias = [
    rua(1, "Avenida do Estado", 5, -600, 20), rua(2, "Avenida do Estado", 5, 20, 600), // a mesma pista, em dois pedaços
    rua(3, "Avenida do Estado", 35), // a pista do outro sentido
    rua(4, "Rua da Mooca", 60),
  ];
  const r = trechoDoPonto(PONTO, vias);
  assert.equal(r.linhas.length, 2, "os dois pedaços da mesma pista são emendados");
  const total = r.linhas.reduce((soma, linha) => soma + comprimento(linha), 0);
  // Duas pistas atravessando o círculo de 300 m: pouco menos de 600 m cada.
  assert.ok(total > 1170 && total < 1205, `comprimento ${total}`);
  // Nenhum vértice passa do raio do trecho (em passos de ~1 m, com folga de arredondamento).
  for (const linha of r.linhas) {
    for (let i = 0; i < linha.length; i += 2) {
      const d = Math.hypot(linha[i] * REGRAS_RUAS.passo * GRAU * COS, linha[i + 1] * REGRAS_RUAS.passo * GRAU);
      assert.ok(d <= REGRAS_RUAS.raioTrecho + 2, `vértice a ${d} m`);
    }
  }
});

test("sem rua de carro por perto o ponto fica sem trecho", () => {
  const r = trechoDoPonto(PONTO, [rua(1, "Rua da Mooca", 90)]);
  assert.deepEqual(r.linhas, []);
  assert.deepEqual(trechoDoPonto(PONTO, []).linhas, []);
});

test("a consulta pede as ruas em volta de cada ponto e a resposta vira a lista de vias", () => {
  const consulta = consultaDasVias([PONTO, { lat: -23.5, lon: -46.6 }]);
  assert.match(consulta, /way\(around:320,-23\.55,-46\.63\)\[highway~"\^\(motorway\|trunk/);
  assert.equal(consulta.match(/way\(around/g).length, 2);
  const vias = viasDaResposta({ elements: [
    { type: "way", id: 7, tags: { name: "Rua A", highway: "residential" }, geometry: [{ lat: -23.5, lon: -46.6 }, { lat: -23.6, lon: -46.7 }] },
    { type: "node", id: 8 },
  ] });
  assert.deepEqual(vias, [{ id: 7, nome: "Rua A", tipo: "residential", geometria: [[-46.6, -23.5], [-46.7, -23.6]] }]);
});

test("o arquivo gerado é um módulo com os trechos e a soma de verificação", () => {
  const texto = textoDoArquivo([{ id: "1", linhas: [[0, 0, 10, 5]] }, { id: "2", linhas: [] }], "2026-10-06");
  assert.match(texto, /export const PASSO = 0\.00001;/);
  assert.match(texto, /"1": \[\[0,0,10,5\]\],/);
  assert.match(texto, /\(hoje: 2\)/);
  assert.match(texto, new RegExp(`export const SOMA = "[0-9a-f]{8}";`));
  assert.equal(somaDeVerificacao("abc"), "1a47e90b");
});
