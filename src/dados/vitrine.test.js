// Testes do modo vitrine: o roteiro e a escolha do bueiro a visitar.
import test from "node:test";
import assert from "node:assert/strict";
import { CENAS, ESPERA_MS, VOLTA_MS, escolherBueiro } from "./vitrine.js";
import { CLIMAS, criarEstadoDemo, gerarPontosDemo } from "./demo.js";
import { trechoDoBueiro } from "../mapa/ruasAfetadas.js";

const AGORA = new Date("2026-10-06T15:00:00Z");
const cidade = (clima) => gerarPontosDemo(AGORA, criarEstadoDemo(clima));

test("o roteiro usa climas que existem, começa e termina no sol e dá tempo de a chuva atravessar", () => {
  const ids = CLIMAS.map((c) => c.id);
  for (const cena of CENAS) assert.ok(ids.includes(cena.clima), `clima ${cena.clima} existe`);
  assert.equal(CENAS[0].clima, "sol");
  assert.equal(CENAS[CENAS.length - 1].clima, "sol", "a volta termina no sol, que é onde a próxima começa");
  CENAS.forEach((cena, i) => {
    const anterior = CENAS[(i - 1 + CENAS.length) % CENAS.length];
    // A troca de clima leva 12 s (7 s de travessia + 5 s de subida, em demo.js).
    if (cena.clima !== anterior.clima) assert.ok(cena.ms >= 13000, `${cena.id}: a cena que troca o clima dura mais que a troca`);
    if (cena.camera === "bueiro") assert.equal(cena.clima, anterior.clima, `${cena.id}: só aproxima de um bueiro depois de a chuva assentar`);
  });
  assert.equal(VOLTA_MS, CENAS.reduce((s, c) => s + c.ms, 0));
  assert.ok(ESPERA_MS >= 30000, "a espera é longa o bastante para não atropelar quem só parou para olhar");
});

test("com sol não há bueiro para visitar; com chuva há, e ele tem a rua desenhada", () => {
  assert.equal(escolherBueiro(cidade("sol"), AGORA), null);
  const forte = escolherBueiro(cidade("chuva-forte"), AGORA, { nivelMinimo: 3 });
  assert.ok(forte && forte.nivel >= 3, "na chuva forte visita um bueiro em nível alto ou crítico");
  assert.ok(trechoDoBueiro(forte), "o bueiro visitado tem o trecho de rua para pintar");
  const critico = escolherBueiro(cidade("chuva-extrema"), AGORA, { nivelMinimo: 4 });
  assert.ok(critico && critico.nivel === 4, "na chuva extrema visita um bueiro crítico");
});

test("a escolha é sempre a mesma, pega o pior bueiro e não repete na mesma volta", () => {
  const pontos = cidade("chuva-extrema");
  const primeiro = escolherBueiro(pontos, AGORA, { nivelMinimo: 3 });
  assert.equal(escolherBueiro([...pontos].reverse(), AGORA, { nivelMinimo: 3 }).id, primeiro.id, "a ordem da lista não muda a escolha");
  assert.ok(pontos.every((p) => !trechoDoBueiro(p) || p.nivel <= primeiro.nivel), "ninguém com rua desenhada tem nível maior");
  const segundo = escolherBueiro(pontos, AGORA, { nivelMinimo: 3, evitar: new Set([primeiro.id]) });
  assert.ok(segundo && segundo.id !== primeiro.id);
});

test("ponto sem posição ou sem previsão não é visitado", () => {
  const base = { id: "a", nivel: 4, probabilidade: 0.5, lat: -23.5, lon: -46.6, status: "VALIDA", validaAte: new Date(AGORA.getTime() + 3600000) };
  assert.equal(escolherBueiro([{ ...base, lat: null }], AGORA), null);
  assert.equal(escolherBueiro([{ ...base, status: "SEM_PREVISAO" }], AGORA), null);
  assert.equal(escolherBueiro([base], AGORA).id, "a");
  // desempate: transbordando vem antes; depois, a maior chance
  const b = { ...base, id: "b", medicaoTransbordando: true, probabilidade: 0.1 };
  const c = { ...base, id: "c", probabilidade: 0.9 };
  assert.equal(escolherBueiro([base, b, c], AGORA).id, "b");
  assert.equal(escolherBueiro([base, c], AGORA).id, "c");
});
