// Testes das ruas afetadas. Rodar com: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { assinaturaDasRuas, nivelDaRua, ruasParaGeoJson, trechoDoBueiro } from "./ruasAfetadas.js";
import { RUAS_DOS_BUEIROS, SOMA } from "../dados/ruasDosBueiros.js";
import { PONTOS_CAPITAL } from "../dados/pontosCapital.js";
import { criarEstadoDemo, gerarPontosDemo } from "../dados/demo.js";
import { distanciaAteCaminho, metros } from "../rotas/geometria.js";
import { somaDeVerificacao } from "../../ferramentas/ruas-nucleo.mjs";

const AGORA = new Date("2026-10-06T15:00:00-03:00");
const valida = (extra) => ({ id: "x", lat: 0, lon: 0, status: "VALIDA", validaAte: new Date(AGORA.getTime() + 600000), medicaoTransbordando: false, ...extra });

test("o arquivo de ruas cobre os pontos e não se corrompeu", () => {
  assert.deepEqual(Object.keys(RUAS_DOS_BUEIROS), PONTOS_CAPITAL.map((p) => p.id));
  const texto = PONTOS_CAPITAL.map((p) => {
    const linhas = JSON.stringify(RUAS_DOS_BUEIROS[p.id]);
    return `${p.id} ${linhas} ${somaDeVerificacao(linhas)}`;
  }).join("\n");
  assert.equal(somaDeVerificacao(texto), SOMA);
  const semTrecho = PONTOS_CAPITAL.filter((p) => RUAS_DOS_BUEIROS[p.id].length === 0);
  assert.ok(semTrecho.length <= 6, `${semTrecho.length} pontos sem trecho`);
});

test("todo trecho fica a até cerca de 300 m do seu bueiro e passa perto dele", () => {
  for (const ponto of PONTOS_CAPITAL) {
    const linhas = trechoDoBueiro(ponto);
    if (linhas.length === 0) continue;
    const posicao = [ponto.lon, ponto.lat];
    let maisPerto = Infinity;
    for (const linha of linhas) {
      assert.ok(linha.length >= 2, ponto.codigo);
      for (const vertice of linha) {
        const d = metros(posicao, vertice);
        assert.ok(d <= 303, `${ponto.codigo}: vértice a ${Math.round(d)} m`);
      }
      maisPerto = Math.min(maisPerto, distanciaAteCaminho(posicao, linha));
    }
    // A rua escolhida pelo nome pode estar a até 80 m do ponto (ferramentas/ruas-nucleo.mjs).
    assert.ok(maisPerto <= 82, `${ponto.codigo}: rua a ${Math.round(maisPerto)} m`);
  }
});

test("um sensor instalado num ponto conhecido ganha o trecho dele; longe de todos, nenhum", () => {
  const base = PONTOS_CAPITAL[0];
  const sensor = { id: "sensor-novo", lat: base.lat + 0.0002, lon: base.lon }; // ~22 m ao norte
  assert.deepEqual(trechoDoBueiro(sensor), trechoDoBueiro(base));
  assert.deepEqual(trechoDoBueiro({ id: "longe", lat: -23.9, lon: -46.2 }), []);
  // Um id igual ao de um ponto conhecido, mas em outro lugar, não herda a rua dele.
  assert.deepEqual(trechoDoBueiro({ id: base.id, lat: -23.9, lon: -46.2 }), []);
});

test("só pinta rua o que vale agora: alto, crítico ou transbordando", () => {
  assert.equal(nivelDaRua(valida({ nivel: 2 }), AGORA), null);
  assert.equal(nivelDaRua(valida({ nivel: 3 }), AGORA), 3);
  assert.equal(nivelDaRua(valida({ nivel: 4 }), AGORA), 4);
  assert.equal(nivelDaRua(valida({ nivel: 1, medicaoTransbordando: true }), AGORA), 4);
  assert.equal(nivelDaRua(valida({ nivel: 4, validaAte: new Date(AGORA.getTime() - 1000) }), AGORA), null, "previsão vencida não pinta");
  assert.equal(nivelDaRua(valida({ nivel: null, status: "SEM_PREVISAO" }), AGORA), null);
});

test("na demonstração: nada pintado com sol, ruas pintadas com chuva forte, mais ainda com chuva extrema", () => {
  const com = (clima) => {
    const pontos = gerarPontosDemo(AGORA, criarEstadoDemo(clima));
    return { geo: ruasParaGeoJson(pontos, AGORA), assinatura: assinaturaDasRuas(pontos, AGORA), pontos };
  };
  assert.equal(com("sol").geo.features.length, 0);
  assert.equal(com("sol").assinatura, "");
  const forte = com("chuva-forte");
  const extrema = com("chuva-extrema");
  assert.ok(forte.geo.features.length >= 20);
  assert.ok(extrema.geo.features.length > forte.geo.features.length);
  assert.notEqual(forte.assinatura, extrema.assinatura);
  for (const f of extrema.geo.features) {
    assert.equal(f.geometry.type, "MultiLineString");
    assert.ok(f.properties.nivel === 3 || f.properties.nivel === 4);
  }
  // As críticas vêm depois das altas, para serem desenhadas por cima.
  const niveis = extrema.geo.features.map((f) => f.properties.nivel);
  assert.deepEqual(niveis, [...niveis].sort((a, b) => a - b));
});
