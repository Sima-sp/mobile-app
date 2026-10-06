// Gera src/dados/ruasDosBueiros.js: o trecho de rua em volta de cada ponto monitorado.
//
// Como usar (precisa de internet e do Node 18 ou mais novo):
//   npm run ruas
//
// O que faz:
//   1. lê os pontos de src/dados/pontosCapital.js;
//   2. pergunta ao OpenStreetMap (serviço Overpass) quais ruas de carro existem a até 320 m de
//      cada ponto, em lotes pequenos e com pausa entre eles (o serviço é público e limita o uso);
//   3. escolhe o trecho de cada ponto com a regra de ruas-nucleo.mjs;
//   4. grava o arquivo e mostra um resumo: quantos pontos ficaram sem trecho e quais foram
//      escolhidos pela via mais próxima em vez do nome do endereço (vale conferir no mapa).
//
// Quando rodar de novo: se a lista de pontos mudar, ou para acompanhar mudanças de traçado no
// OpenStreetMap. O app não depende disto para funcionar: sem o trecho, a tampa aparece igual.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PONTOS_CAPITAL } from "../src/dados/pontosCapital.js";
import { consultaDasVias, textoDoArquivo, trechoDoPonto, viasDaResposta } from "./ruas-nucleo.mjs";

const SERVICO = process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const LOTE = 6;
const PAUSA_MS = 2500;
const PAUSA_APOS_ERRO_MS = 15000;
const VOLTAS = 12;
const DESTINO = fileURLToPath(new URL("../src/dados/ruasDosBueiros.js", import.meta.url));

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function buscarVias(pontos) {
  const vias = new Map();
  const feitos = new Set();
  for (let volta = 1; volta <= VOLTAS; volta += 1) {
    const faltam = pontos.filter((p) => !feitos.has(p.id));
    if (faltam.length === 0) break;
    console.log(`Volta ${volta}: faltam ${faltam.length} pontos.`);
    for (let i = 0; i < faltam.length; i += LOTE) {
      const lote = faltam.slice(i, i + LOTE);
      let pausa = PAUSA_MS;
      try {
        const resposta = await fetch(SERVICO, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(consultaDasVias(lote))}`,
        });
        if (!resposta.ok) throw new Error(`o serviço respondeu ${resposta.status}`);
        const dados = await resposta.json();
        if (dados.remark) throw new Error(dados.remark); // consulta cortada por tempo ou memória
        for (const via of viasDaResposta(dados)) vias.set(via.id, via);
        for (const p of lote) feitos.add(p.id);
      } catch (erro) {
        console.log(`  lote adiado (${erro.message}).`);
        pausa = PAUSA_APOS_ERRO_MS;
      }
      await esperar(pausa);
    }
  }
  const semResposta = pontos.filter((p) => !feitos.has(p.id));
  if (semResposta.length) throw new Error(`O serviço não respondeu para ${semResposta.length} pontos. Tente de novo mais tarde.`);
  return [...vias.values()];
}

const vias = await buscarVias(PONTOS_CAPITAL);
const resultados = PONTOS_CAPITAL.map((ponto) => ({ ponto, ...trechoDoPonto(ponto, vias) }));
const hoje = new Date().toISOString().slice(0, 10);
writeFileSync(DESTINO, textoDoArquivo(resultados.map((r) => ({ id: r.ponto.id, linhas: r.linhas })), hoje));

const semTrecho = resultados.filter((r) => r.linhas.length === 0);
const pelaMaisProxima = resultados.filter((r) => r.linhas.length && !r.pelaNome);
console.log(`\n${vias.length} vias lidas. Arquivo gravado em ${DESTINO}.`);
console.log(`${resultados.length - semTrecho.length} de ${resultados.length} pontos com trecho.`);
if (semTrecho.length) console.log(`Sem rua de carro por perto: ${semTrecho.map((r) => r.ponto.codigo).join(", ")}.`);
if (pelaMaisProxima.length) {
  console.log("Escolhidos pela via mais próxima (o nome do endereço não foi achado por perto):");
  for (const r of pelaMaisProxima) console.log(`  ${r.ponto.codigo}  ${r.ponto.endereco}  →  ${r.via ?? "via sem nome"} (${r.distancia} m)`);
}
