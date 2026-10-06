// Testes da demonstração: os pontos da capital, o efeito de cada clima e a troca gradual.

import test from "node:test";
import assert from "node:assert/strict";

import { CLIMAS, LIMIARES, PONTOS_BASE, criarEstadoDemo, emTransicao, gerarPontosDemo, intensidades, situacaoDoPonto, trocarClima } from "./demo.js";
import { PONTOS_CAPITAL } from "./pontosCapital.js";
import { statusAgora } from "./modelo.js";

const AGORA = new Date("2026-10-06T15:00:00Z");
const daqui = (segundos) => new Date(AGORA.getTime() + segundos * 1000);
const niveis = (clima) => {
  const pontos = gerarPontosDemo(AGORA, criarEstadoDemo(clima));
  return [1, 2, 3, 4].map((n) => pontos.filter((p) => p.nivel === n).length);
};

test("pontos da capital: 136 lugares, ids e códigos únicos, dentro de São Paulo", () => {
  assert.equal(PONTOS_CAPITAL.length, 136);
  assert.equal(new Set(PONTOS_CAPITAL.map((p) => p.id)).size, 136);
  assert.equal(new Set(PONTOS_CAPITAL.map((p) => p.codigo)).size, 136);
  for (const p of PONTOS_CAPITAL) {
    assert.ok(p.lat > -23.75 && p.lat < -23.38, `${p.codigo} latitude`);
    assert.ok(p.lon > -46.80 && p.lon < -46.38, `${p.codigo} longitude`);
    assert.match(p.codigo, /^[A-Z]{2}-\d{2}$/);
    assert.ok(p.endereco && p.bairro);
  }
});

test("todos os sensores funcionando: leitura recente e previsão válida em qualquer clima", () => {
  for (const clima of CLIMAS) {
    for (const p of gerarPontosDemo(AGORA, criarEstadoDemo(clima.id))) {
      assert.equal(p.statusSensor, "ATIVO");
      assert.equal(p.semLeituraSensor, false);
      assert.ok(p.agua >= 0 && p.agua <= 100);
      assert.ok(p.lixo >= 0 && p.lixo <= 100);
      assert.ok(AGORA - p.leituraEm <= 9 * 60000);
      assert.equal(statusAgora(p, AGORA), "VALIDA");
      assert.equal(p.historicoAgua.length, 12);
      assert.equal(p.historicoAgua.at(-1), p.agua);
    }
  }
});

test("sol: cidade inteira em nível baixo e sem chuva", () => {
  assert.deepEqual(niveis("sol"), [136, 0, 0, 0]);
  for (const p of gerarPontosDemo(AGORA, criarEstadoDemo("sol"))) {
    assert.equal(p.chuvaRecente3h, 0);
    assert.ok(p.agua < 20);
    assert.equal(p.medicaoTransbordando, false);
  }
});

test("cada clima é visivelmente pior que o anterior", () => {
  const [sol, chuvisco, forte, extrema] = ["sol", "chuvisco", "chuva-forte", "chuva-extrema"].map(niveis);
  // chuvisco: maioria em baixo, alguns em médio (os entupidos), ninguém em alto
  assert.ok(chuvisco[0] > 90 && chuvisco[1] > 10 && chuvisco[2] + chuvisco[3] === 0, `chuvisco ${chuvisco}`);
  // chuva forte: de tudo um pouco, com críticos
  assert.ok(forte[0] > 10 && forte[1] > 40 && forte[2] > 15 && forte[3] > 3, `forte ${forte}`);
  // chuva extrema: a maioria em alto ou crítico
  assert.ok(extrema[2] + extrema[3] > 90 && extrema[3] > 30, `extrema ${extrema}`);
  // nenhum ponto melhora quando a chuva aumenta
  const ordem = ["sol", "chuvisco", "chuva-forte", "chuva-extrema"].map((c) => gerarPontosDemo(AGORA, criarEstadoDemo(c)));
  for (let i = 0; i < 136; i += 1) {
    for (let c = 1; c < ordem.length; c += 1) {
      assert.ok(ordem[c][i].nivel >= ordem[c - 1][i].nivel, ordem[c][i].codigo);
      assert.ok(ordem[c][i].agua >= ordem[c - 1][i].agua, ordem[c][i].codigo);
      assert.ok(ordem[c][i].probabilidade >= ordem[c - 1][i].probabilidade, ordem[c][i].codigo);
    }
  }
  assert.deepEqual(sol, [136, 0, 0, 0]);
});

test("só a chuva extrema faz bueiro transbordar, e quem transborda é crítico", () => {
  const transbordando = (clima) => gerarPontosDemo(AGORA, criarEstadoDemo(clima)).filter((p) => p.medicaoTransbordando);
  assert.equal(transbordando("chuvisco").length, 0);
  const naExtrema = transbordando("chuva-extrema");
  assert.ok(naExtrema.length >= 8 && naExtrema.length <= 30, `transbordando: ${naExtrema.length}`);
  for (const p of naExtrema) {
    assert.equal(p.agua, 100);
    assert.equal(p.nivel, 4);
  }
});

test("o nível segue os limiares do modelo e as regras do sensor", () => {
  for (const clima of CLIMAS) {
    for (const p of gerarPontosDemo(AGORA, criarEstadoDemo(clima.id))) {
      const esperadoPeloModelo = p.probabilidade >= LIMIARES.critico ? 4 : p.probabilidade >= LIMIARES.alto ? 3 : p.probabilidade >= LIMIARES.medio ? 2 : 1;
      assert.equal(p.nivelModelo, esperadoPeloModelo, p.codigo);
      assert.ok(p.nivel >= p.nivelModelo, p.codigo); // o sensor nunca desce o nível
      assert.equal(p.ajusteSensorAplicado, p.nivel > p.nivelModelo, p.codigo);
      if (p.nivel > p.nivelModelo) assert.ok(p.agua >= 80 || p.lixo >= 60, `${p.codigo} subiu sem motivo`);
    }
  }
});

test("quem alaga mais e fica perto de córrego reage mais", () => {
  const maisSensivel = PONTOS_BASE.reduce((a, b) => (a.sensibilidade > b.sensibilidade ? a : b));
  const menosSensivel = PONTOS_BASE.reduce((a, b) => (a.sensibilidade < b.sensibilidade ? a : b));
  assert.ok(maisSensivel.freqHistorica > menosSensivel.freqHistorica);
  const mesmoLugar = { manchaDeChuva: 1, lixo: 30, aguaSeca: 10 };
  const forte = situacaoDoPonto({ ...maisSensivel, ...mesmoLugar }, 0.68);
  const fraco = situacaoDoPonto({ ...menosSensivel, ...mesmoLugar }, 0.68);
  assert.ok(forte.agua > fraco.agua && forte.probabilidade > fraco.probabilidade);
});

test("troca de clima: gradual, de oeste para leste, e termina no clima escolhido", () => {
  const inicial = criarEstadoDemo("sol");
  assert.equal(emTransicao(inicial, AGORA), false);
  const trocado = trocarClima(inicial, "chuva-extrema", AGORA);
  assert.equal(trocarClima(trocado, "chuva-extrema", daqui(1)), trocado); // mesmo clima: nada muda

  // no instante da troca ninguém mudou ainda
  assert.deepEqual(gerarPontosDemo(AGORA, trocado).map((p) => p.nivel), gerarPontosDemo(AGORA, inicial).map((p) => p.nivel));
  assert.equal(emTransicao(trocado, daqui(1)), true);

  // no meio: o oeste já sente a chuva, o leste ainda não
  const noMeio = intensidades(trocado, daqui(4));
  const maisAOeste = PONTOS_CAPITAL.reduce((a, p, i) => (p.lon < PONTOS_CAPITAL[a].lon ? i : a), 0);
  const maisALeste = PONTOS_CAPITAL.reduce((a, p, i) => (p.lon > PONTOS_CAPITAL[a].lon ? i : a), 0);
  assert.ok(noMeio[maisAOeste] > 0.5, `oeste: ${noMeio[maisAOeste]}`);
  assert.ok(noMeio[maisALeste] < 0.05, `leste: ${noMeio[maisALeste]}`);

  // no fim: igual ao clima assentado
  assert.equal(emTransicao(trocado, daqui(13)), false);
  assert.deepEqual(gerarPontosDemo(daqui(13), trocado).map((p) => p.nivel),
    gerarPontosDemo(daqui(13), criarEstadoDemo("chuva-extrema")).map((p) => p.nivel));

  // trocar de novo no meio do caminho parte de onde cada ponto está, sem salto
  const devolta = trocarClima(trocado, "sol", daqui(4));
  assert.deepEqual(intensidades(devolta, daqui(4)), noMeio);
});
