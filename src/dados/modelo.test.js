// Testes das regras de dados do app. Rodar com: npm test
// Usam o executor de testes que já vem com o Node (node --test), sem dependência extra. Por isso
// os arquivos de src/dados importam uns aos outros com a extensão ".js".

import test from "node:test";
import assert from "node:assert/strict";

import { nivelDeTexto, rotuloNivel } from "./niveis.js";
import {
  codigoDoPonto, fatosDoCartao, haQuanto, lerData, linhaSituacao, normalizarPrevisao, resumoLeitura, resumoPrevisao, separarVizinhanca,
  statusAgora, textoProbabilidade,
} from "./modelo.js";
import { resumirBairros } from "./bairros.js";

const AGORA = new Date("2026-10-06T15:00:00Z");
const emMinutos = (m) => new Date(AGORA.getTime() + m * 60000);

test("nível: aceita o texto do backend com ou sem acento", () => {
  assert.equal(nivelDeTexto("MEDIO"), 2);
  assert.equal(nivelDeTexto("Médio"), 2);
  assert.equal(nivelDeTexto("CRÍTICO"), 4);
  assert.equal(nivelDeTexto("qualquer coisa"), null);
  assert.equal(nivelDeTexto(null), null);
  assert.equal(rotuloNivel(null), "Sem previsão");
});

test("vizinhança: separa endereço e bairro só quando há travessão", () => {
  assert.deepEqual(separarVizinhanca("R. Chico Pontes — Vila Maria / Vila Guilherme"),
    { endereco: "R. Chico Pontes", bairro: "Vila Maria / Vila Guilherme" });
  assert.deepEqual(separarVizinhanca("Jaçanã-Tremembé"), { endereco: null, bairro: "Jaçanã-Tremembé" });
  assert.deepEqual(separarVizinhanca(null), { endereco: null, bairro: null });
});

test("código do ponto: sigla do bairro + id", () => {
  assert.equal(codigoDoPonto("Vila Guilherme", 5), "VG-05");
  assert.equal(codigoDoPonto("Santana / Tucuruvi", 12), "SA-12");
  assert.equal(codigoDoPonto("Freguesia do Ó", 3), "FO-03");
  assert.equal(codigoDoPonto(null, 7), "PT-07");
});

// Itens reais de GET /previsoes, copiados do backend em 06/10/2026.
const ITEM_REAL = { sensorId: 6, latitude: -23.5034, longitude: -46.6249, vizinhanca: "Local de teste 06", status: "VALIDA",
  probabilidadeAlagamento: 0.0012, nivelRisco: "BAIXO", nivelRiscoModelo: "BAIXO", janelaHoras: 3,
  geradaEm: "2026-10-06T13:18:18", validaAte: "2026-10-06T13:48:18", horaReferencia: "2026-10-06T13:00:00",
  medicaoTransbordando: false, ajusteSensorAplicado: false, semLeituraSensor: true, motivosAjuste: [],
  chuvaRecente3hMm: 1.2, chuvaPrevista3hMm: 12.9, origem: "MODELO", modeloVersao: "v1", simulada: false };
const ITEM_REAL_SEM_PREVISAO = { sensorId: 7, latitude: -23.65, longitude: -46.71, vizinhanca: "Local de teste 07", status: "SEM_PREVISAO",
  probabilidadeAlagamento: null, nivelRisco: null, nivelRiscoModelo: null, janelaHoras: null, geradaEm: null, validaAte: null,
  horaReferencia: null, medicaoTransbordando: false, ajusteSensorAplicado: false, semLeituraSensor: true, motivosAjuste: [],
  chuvaRecente3hMm: null, chuvaPrevista3hMm: null, origem: null, modeloVersao: null, simulada: false };

test("normalizarPrevisao: item real do backend", () => {
  const p = normalizarPrevisao(ITEM_REAL);
  assert.equal(p.id, "6");
  assert.equal(p.codigo, "LT-06");
  assert.equal(p.bairro, "Local de teste 06");
  assert.equal(p.endereco, null);
  assert.equal(p.nivel, 1);
  assert.equal(p.nivelModelo, 1);
  assert.equal(p.probabilidade, 0.0012);
  assert.equal(p.chuvaPrevista3h, 12.9);
  assert.equal(p.modeloVersao, "v1");
  assert.equal(p.semLeituraSensor, true);
  // Campos que o backend ainda não manda ficam vazios, e a tela diz "Sem leitura".
  assert.equal(p.agua, null);
  assert.equal(p.statusSensor, null);
  assert.equal(resumoLeitura(p, AGORA).titulo, "Sem leitura");
});

test("normalizarPrevisao: datas sem fuso são lidas como horário de São Paulo", () => {
  const p = normalizarPrevisao(ITEM_REAL);
  assert.equal(p.geradaEm.toISOString(), "2026-10-06T16:18:18.000Z"); // 13:18 em São Paulo
  assert.equal(p.validaAte.toISOString(), "2026-10-06T16:48:18.000Z");
  assert.equal(lerData("2026-10-06T16:18:18Z").toISOString(), "2026-10-06T16:18:18.000Z");
  assert.equal(lerData("2026-10-06T13:18:18-03:00").toISOString(), "2026-10-06T16:18:18.000Z");
  assert.equal(lerData(null), null);
  assert.equal(statusAgora(p, new Date("2026-10-06T16:30:00Z")), "VALIDA");
  assert.equal(statusAgora(p, new Date("2026-10-06T16:50:00Z")), "DESATUALIZADA");
});

test("normalizarPrevisao: vizinhança com travessão vira endereço e bairro", () => {
  const p = normalizarPrevisao({ ...ITEM_REAL, sensorId: 5, vizinhanca: "R. Chico Pontes — Vila Maria / Vila Guilherme" });
  assert.equal(p.endereco, "R. Chico Pontes");
  assert.equal(p.bairro, "Vila Maria / Vila Guilherme");
  assert.equal(p.codigo, "VM-05");
});

test("normalizarPrevisao: leitura e status do sensor aparecem quando o backend mandar", () => {
  const p = normalizarPrevisao({ ...ITEM_REAL, semLeituraSensor: false, statusSensor: "ATIVO", nivelAgua: 82, porcentagemLixo: 64, // o backend ainda pode mandar o lixo; o app ignora
    dataLeitura: "2026-10-06T13:15:00", nivelRisco: "MEDIO", ajusteSensorAplicado: true });
  assert.equal(p.agua, 82);
  assert.equal("lixo" in p, false, "o app ignora o lixo: o sensor mede só a água");
  assert.equal(p.nivel, 2);
  assert.equal(p.nivelModelo, 1);
  assert.equal(p.ajusteSensorAplicado, true);
  assert.equal(resumoLeitura(p, new Date("2026-10-06T16:18:00Z")).titulo, "82% de água");
});

test("normalizarPrevisao: sem posição fica fora; sem nível vira SEM_PREVISAO", () => {
  assert.equal(normalizarPrevisao({ sensorId: 9, nivelRisco: "BAIXO" }), null);
  const semNivel = normalizarPrevisao(ITEM_REAL_SEM_PREVISAO);
  assert.equal(semNivel.status, "SEM_PREVISAO");
  assert.equal(semNivel.janelaHoras, 3);
  assert.equal(statusAgora(semNivel, AGORA), "SEM_PREVISAO");
  assert.equal(resumoPrevisao(semNivel, AGORA).tipo, "sem-previsao");
});

test("status: previsão vencida no relógio do aparelho vira DESATUALIZADA", () => {
  const base = { nivel: 3, status: "VALIDA", geradaEm: emMinutos(-40) };
  assert.equal(statusAgora({ ...base, validaAte: emMinutos(5) }, AGORA), "VALIDA");
  assert.equal(statusAgora({ ...base, validaAte: emMinutos(-10) }, AGORA), "DESATUALIZADA");
  assert.equal(statusAgora({ ...base, validaAte: null }, AGORA), "VALIDA");
});

test("probabilidade: números pequenos ganham uma casa decimal", () => {
  assert.equal(textoProbabilidade(0.034), "3,4%");
  assert.equal(textoProbabilidade(0.0049), "0,5%");
  assert.equal(textoProbabilidade(0.0004), "menos de 0,1%");
  assert.equal(textoProbabilidade(0.31), "31%");
  assert.equal(textoProbabilidade(null), null);
});

test("resumo da previsão: medição de transbordo esconde a porcentagem", () => {
  const ponto = { nivel: 4, status: "VALIDA", validaAte: emMinutos(20), probabilidade: 0.06, janelaHoras: 3, medicaoTransbordando: true };
  assert.equal(resumoPrevisao(ponto, AGORA).tipo, "transbordando");
  assert.equal(resumoPrevisao({ ...ponto, medicaoTransbordando: false }, AGORA).titulo, "6,0% em 3 h");
  assert.equal(resumoPrevisao({ ...ponto, medicaoTransbordando: false, probabilidade: null }, AGORA).tipo, "regras");
  assert.equal(resumoPrevisao({ ...ponto, medicaoTransbordando: false, validaAte: emMinutos(-1), geradaEm: emMinutos(-31) }, AGORA).tipo, "desatualizada");
});

test("resumo da leitura e linha de situação", () => {
  const ponto = { nivel: 3, status: "VALIDA", validaAte: emMinutos(20), statusSensor: "ATIVO", agua: 71, leituraEm: emMinutos(-3), codigo: "VG-01" };
  assert.equal(resumoLeitura(ponto, AGORA).titulo, "71% de água");
  assert.equal(linhaSituacao(ponto, AGORA), "Alto · leitura há 3 min");
  assert.equal(resumoLeitura({ ...ponto, agua: null, statusSensor: "MANUTENCAO" }, AGORA).detalhe, "Sensor em manutenção");
  assert.equal(haQuanto(emMinutos(-125), AGORA), "há 2 h");
});

test("cartão do bueiro: dois números (água medida e chance prevista), com traço quando falta o dado", () => {
  const ponto = { nivel: 3, status: "VALIDA", validaAte: emMinutos(20), statusSensor: "ATIVO", agua: 71, probabilidade: 0.034, janelaHoras: 3 };
  const valores = (p) => fatosDoCartao(p, AGORA).map((f) => `${f.rotulo}: ${f.valor}`);
  assert.deepEqual(valores(ponto), ["Água no bueiro: 71%", "Chance em 3 h: 3,4%"]);
  // Probabilidade muito pequena cabe na coluna.
  assert.equal(fatosDoCartao({ ...ponto, probabilidade: 0.0004 }, AGORA)[1].valor, "< 0,1%");
  // Sem leitura do sensor: a água vira traço, a previsão continua.
  assert.deepEqual(valores({ ...ponto, agua: null, semLeituraSensor: true }), ["Água no bueiro: —", "Chance em 3 h: 3,4%"]);
  assert.equal(fatosDoCartao({ ...ponto, statusSensor: "INATIVO" }, AGORA)[0].descricao, "Água: sem leitura do sensor");
  // Sem a IA (regras) mostra o nível; previsão vencida ou ausente vira traço.
  assert.equal(valores({ ...ponto, probabilidade: null })[1], "Risco em 3 h: Alto");
  assert.equal(valores({ ...ponto, validaAte: emMinutos(-1) })[1], "Chance em 3 h: —");
  assert.equal(valores({ ...ponto, nivel: null, status: "SEM_PREVISAO" })[1], "Chance em 3 h: —");
  // Bueiro cheio é medição: no lugar da chance, "agora".
  assert.equal(valores({ ...ponto, agua: 100, nivel: 4, medicaoTransbordando: true })[1], "Transbordando: Agora");
});

test("bairros: contagem por nível e ordem do pior para o mais tranquilo", () => {
  const ponto = (id, bairro, nivel, extra = {}) => ({ id, codigo: `X-${id}`, bairro, nivel, status: nivel ? "VALIDA" : "SEM_PREVISAO",
    validaAte: nivel ? emMinutos(20) : null, agua: 10 * (nivel ?? 0), chuvaRecente3h: 12, medicaoTransbordando: false, ...extra });
  const bairros = resumirBairros([
    ponto("1", "Lapa", 1), ponto("2", "Lapa", 2), ponto("3", "Lapa", null),
    ponto("4", "Mooca", 4, { medicaoTransbordando: true }), ponto("5", "Mooca", 3), ponto("6", "Mooca", 1),
    ponto("7", "Sé", 3, { validaAte: emMinutos(-5) }),
  ], AGORA);
  assert.deepEqual(bairros.map((b) => b.nome), ["Mooca", "Sé", "Lapa"]);
  const mooca = bairros[0];
  assert.deepEqual(mooca.contagem, [1, 0, 1, 1]);
  assert.equal(mooca.pior, 4);
  assert.equal(mooca.pontos[0].id, "4"); // o que está transbordando vem primeiro
  assert.equal(mooca.chuvaMedia, 12);
  const lapa = bairros[2];
  assert.equal(lapa.semPrevisao, 1);
  assert.equal(lapa.total, 3);
});
