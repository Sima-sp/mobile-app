// Testes do aviso por região. Rodar com: npm test

import test from "node:test";
import assert from "node:assert/strict";
import { REGRA_REGIAO, apoioDaRegiao, avisosPorRegiao, fraseDaRegiao, resumoDosAvisos } from "./regioes.js";
import { criarEstadoDemo, gerarPontosDemo } from "./demo.js";

const AGORA = new Date("2026-10-06T15:00:00-03:00");
const ponto = (id, bairro, probabilidade, extra = {}) => ({
  id, codigo: `X-${id}`, bairro, nivel: 1, probabilidade, status: "VALIDA", validaAte: new Date(AGORA.getTime() + 600000),
  medicaoTransbordando: false, agua: 10, ...extra,
});
const regiao = (lista, nome) => avisosPorRegiao(lista, AGORA).find((r) => r.nome === nome);

test("a região usa a maior chance entre os pontos e os limiares próprios", () => {
  const lista = [ponto(1, "Sé", 0.001), ponto(2, "Sé", 0.0105), ponto(3, "Sé", 0.002)];
  assert.equal(regiao(lista, "Sé").nivel, 2);
  assert.equal(regiao(lista, "Sé").maiorChance, 0.0105);
  assert.equal(apoioDaRegiao(regiao(lista, "Sé")), "Nenhum bueiro em nível alto por enquanto");
  lista[0].probabilidade = REGRA_REGIAO.alto;
  assert.equal(regiao(lista, "Sé").nivel, 3);
  lista[0].probabilidade = 0.0101;
  lista[1].probabilidade = 0.0101;
  assert.equal(regiao(lista, "Sé").nivel, null, "abaixo de 1,02 % não há aviso");
});

test("região com menos de 3 pontos não recebe aviso, mesmo com chance alta", () => {
  const lista = [ponto(1, "Itaquera", 0.3, { nivel: 4 }), ponto(2, "Itaquera", 0.2, { nivel: 3 })];
  const r = regiao(lista, "Itaquera");
  assert.equal(r.cobertura, false);
  assert.equal(r.nivel, null);
  assert.equal(r.emRisco, 2);
  assert.match(fraseDaRegiao(r), /não recebe aviso/);
});

test("previsão vencida ou sem probabilidade não entra na conta", () => {
  const vencida = new Date(AGORA.getTime() - 60000);
  const lista = [ponto(1, "Lapa", 0.2, { validaAte: vencida }), ponto(2, "Lapa", null), ponto(3, "Lapa", 0.002)];
  const r = regiao(lista, "Lapa");
  assert.equal(r.maiorChance, 0.002);
  assert.equal(r.nivel, null);
});

test("bueiro transbordando põe a região em risco alto e o aviso diz que é medição", () => {
  const lista = [ponto(1, "Mooca", 0.001), ponto(2, "Mooca", 0.001, { medicaoTransbordando: true, nivel: 4 }), ponto(3, "Mooca", 0.001)];
  const r = regiao(lista, "Mooca");
  assert.equal(r.nivel, 3);
  assert.equal(r.transbordando, 1);
  assert.match(fraseDaRegiao(r), /1 bueiro transbordando agora, medido pelo sensor/);
  assert.equal(apoioDaRegiao(r), "1 bueiro transbordando agora · 1 de 3 bueiros em nível alto ou crítico");
});

test("a ordem é do aviso mais grave para o mais leve", () => {
  const tres = (bairro, chance) => [1, 2, 3].map((n) => ponto(`${bairro}${n}`, bairro, chance));
  const regioes = avisosPorRegiao([...tres("Calmo", 0.001), ...tres("Atento", 0.015), ...tres("Grave", 0.05), ...tres("Gravíssimo", 0.2)], AGORA);
  assert.deepEqual(regioes.map((r) => r.nome), ["Gravíssimo", "Grave", "Atento", "Calmo"]);
});

test("o aviso do mapa fala do nível mais grave e some quando não há aviso", () => {
  const tres = (bairro, chance) => [1, 2, 3].map((n) => ponto(`${bairro}${n}`, bairro, chance));
  assert.equal(resumoDosAvisos(avisosPorRegiao(tres("Sé", 0.001), AGORA)), null);
  const um = resumoDosAvisos(avisosPorRegiao([...tres("Vila Maria / Vila Guilherme", 0.05), ...tres("Lapa", 0.015)], AGORA));
  assert.deepEqual([um.nivel, um.texto], [3, "Risco alto: Vila Maria"]);
  const dois = resumoDosAvisos(avisosPorRegiao([...tres("Sé", 0.05), ...tres("Lapa", 0.04)], AGORA));
  assert.equal(dois.texto, "Risco alto: Sé e Lapa");
  const varios = resumoDosAvisos(avisosPorRegiao([...tres("Sé", 0.015), ...tres("Lapa", 0.015), ...tres("Mooca", 0.015)], AGORA));
  assert.deepEqual([varios.nivel, varios.texto], [2, "Atenção em 3 regiões"]);
  assert.match(varios.descricao, /Lapa, Mooca e Sé|Sé, Lapa e Mooca|Lapa, Sé e Mooca|Mooca, Lapa e Sé|Mooca, Sé e Lapa|Sé, Mooca e Lapa/);
});

test("na demonstração: sem aviso com sol e chuvisco, avisos com chuva forte, todas as regiões cobertas com chuva extrema", () => {
  const regioesCom = (clima) => avisosPorRegiao(gerarPontosDemo(AGORA, criarEstadoDemo(clima)), AGORA);
  for (const clima of ["sol", "chuvisco"]) assert.equal(regioesCom(clima).filter((r) => r.nivel).length, 0, clima);
  const forte = regioesCom("chuva-forte");
  assert.ok(forte.filter((r) => r.nivel === 3).length >= 4, "chuva forte deixa várias regiões em risco alto");
  assert.ok(forte.filter((r) => r.cobertura && r.nivel !== 3).length >= 2, "mas não todas");
  const extrema = regioesCom("chuva-extrema");
  const cobertas = extrema.filter((r) => r.cobertura);
  assert.equal(cobertas.length, 15);
  assert.ok(cobertas.every((r) => r.nivel === 3));
  assert.ok(extrema.filter((r) => !r.cobertura).every((r) => r.nivel === null));
});
