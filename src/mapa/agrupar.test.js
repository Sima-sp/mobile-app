// Testes do agrupamento de marcadores.

import test from "node:test";
import assert from "node:assert/strict";

import { agruparPontos, pixelNoZoom } from "./agrupar.js";
import { PONTOS_CAPITAL } from "../dados/pontosCapital.js";

test("pixelNoZoom: dobra de escala a cada nível de zoom", () => {
  const a = pixelNoZoom(-46.63, -23.55, 10);
  const b = pixelNoZoom(-46.63, -23.55, 11);
  assert.ok(Math.abs(b.x - 2 * a.x) < 1e-6 && Math.abs(b.y - 2 * a.y) < 1e-6);
  // 0,01 grau de longitude no zoom 14 dá cerca de 233 pixels
  const d = pixelNoZoom(-46.62, -23.55, 14).x - pixelNoZoom(-46.63, -23.55, 14).x;
  assert.ok(d > 225 && d < 240, `distância: ${d}`);
});

test("pontos próximos se juntam no mapa afastado e se separam de perto", () => {
  const pontos = [
    { id: "a", lon: -46.6300, lat: -23.5500 },
    { id: "b", lon: -46.6305, lat: -23.5502 }, // a ~55 m de "a"
    { id: "c", lon: -46.5000, lat: -23.5000 }, // longe
  ];
  const longe = agruparPontos(pontos, 11);
  assert.equal(longe.length, 2);
  assert.deepEqual(longe[0].membros.map((p) => p.id), ["a", "b"]);
  assert.equal(longe[0].chave, "ga-2");
  assert.ok(Math.abs(longe[0].lon - -46.63025) < 1e-9); // o grupo fica no meio dos membros
  assert.equal(longe[1].chave, "pc");

  const perto = agruparPontos(pontos, 17);
  assert.deepEqual(perto.map((g) => g.chave), ["pa", "pb", "pc"]);
});

test("o ponto selecionado nunca entra em grupo", () => {
  const pontos = [{ id: "a", lon: -46.63, lat: -23.55 }, { id: "b", lon: -46.6301, lat: -23.55 }, { id: "c", lon: -46.6302, lat: -23.55 }];
  assert.equal(agruparPontos(pontos, 10).length, 1);
  const comSelecao = agruparPontos(pontos, 10, { sozinho: "b" });
  assert.deepEqual(comSelecao.map((g) => g.chave).sort(), ["ga-2", "pb"]);
});

test("capital inteira: poucos marcadores de longe, todos os pontos de perto, ninguém se perde", () => {
  const deLonge = agruparPontos(PONTOS_CAPITAL, 9.75);
  assert.ok(deLonge.length < 40, `marcadores de longe: ${deLonge.length}`);
  assert.equal(deLonge.reduce((soma, g) => soma + g.membros.length, 0), 136);
  const dePerto = agruparPontos(PONTOS_CAPITAL, 16);
  assert.ok(dePerto.length > 125, `marcadores de perto: ${dePerto.length}`);
  // o agrupamento não depende da ordem do risco: mesma entrada, mesmo resultado
  assert.deepEqual(agruparPontos(PONTOS_CAPITAL, 12).map((g) => g.chave), agruparPontos([...PONTOS_CAPITAL], 12).map((g) => g.chave));
});
