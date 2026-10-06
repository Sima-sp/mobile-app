// Ruas afetadas: o trecho de rua em volta de cada bueiro em nível alto ou crítico, pintado no mapa
// com a cor do nível. É o que responde "quais ruas estão em risco agora?" num relance.
//
// De onde vem o traçado: de src/dados/ruasDosBueiros.js, um arquivo gerado uma vez a partir do
// OpenStreetMap (ferramentas/gerar-ruas.mjs). Para cada ponto monitorado ele guarda cerca de 300 m
// da rua para cada lado. Nada é buscado na rede na hora de desenhar, então funciona sem internet.
//
// O QUE ISTO NÃO É: a mancha de um alagamento. O SIMA monitora o bueiro, não a rua inteira. O
// trecho pintado diz "o risco é aqui, nesta rua", com um tamanho fixo; não mede até onde a água
// chegaria. A tela Sobre explica isso para quem usa.
//
// Um bueiro que não está na lista dos pontos conhecidos (um sensor novo, por exemplo) fica sem
// trecho até o arquivo ser gerado de novo; a tampa dele continua aparecendo normalmente.

import { PASSO, RUAS_DOS_BUEIROS } from "../dados/ruasDosBueiros.js";
import { PONTOS_CAPITAL } from "../dados/pontosCapital.js";
import { statusAgora } from "../dados/modelo.js";
import { metros } from "../rotas/geometria.js";

/** Até que distância um bueiro é considerado "o mesmo lugar" de um ponto com trecho guardado. */
const MESMO_LUGAR = 40; // metros

const ANCORAS = PONTOS_CAPITAL.filter((p) => RUAS_DOS_BUEIROS[p.id]?.length).map((p) => ({ id: p.id, lon: p.lon, lat: p.lat }));
const POR_ID = new Map(ANCORAS.map((a) => [a.id, a]));

/** Abre um trecho guardado (passos a partir da posição do ponto) em listas de [lon, lat]. */
function abrir(ancora) {
  return RUAS_DOS_BUEIROS[ancora.id].map((linha) => {
    const caminho = [];
    for (let i = 0; i < linha.length; i += 2) {
      caminho.push([Number((ancora.lon + linha[i] * PASSO).toFixed(6)), Number((ancora.lat + linha[i + 1] * PASSO).toFixed(6))]);
    }
    return caminho;
  });
}

const abertos = new Map(); // id da âncora → linhas já convertidas

/**
 * As linhas da rua de um bueiro: lista de caminhos, cada um uma lista de [lon, lat].
 * Procura primeiro pelo id (os pontos da demonstração); depois pelo ponto guardado mais próximo,
 * para um sensor de verdade instalado num ponto conhecido também ganhar o trecho.
 */
export function trechoDoBueiro(ponto) {
  let ancora = POR_ID.get(String(ponto.id));
  if (ancora && metros([ancora.lon, ancora.lat], [ponto.lon, ponto.lat]) > MESMO_LUGAR) ancora = null;
  if (!ancora) {
    let menor = MESMO_LUGAR;
    for (const candidata of ANCORAS) {
      const d = metros([candidata.lon, candidata.lat], [ponto.lon, ponto.lat]);
      if (d <= menor) { menor = d; ancora = candidata; }
    }
  }
  if (!ancora) return [];
  if (!abertos.has(ancora.id)) abertos.set(ancora.id, abrir(ancora));
  return abertos.get(ancora.id);
}

/**
 * Nível com que a rua do bueiro é pintada, ou null quando ela não é pintada.
 * Só entra o que vale agora: bueiro transbordando (medido) ou previsão válida em alto ou crítico.
 * Previsão desatualizada não pinta rua.
 */
export function nivelDaRua(ponto, agora = new Date()) {
  if (ponto.medicaoTransbordando) return 4;
  if (statusAgora(ponto, agora) !== "VALIDA") return null;
  return ponto.nivel >= 3 ? ponto.nivel : null;
}

/** Texto curto que muda só quando muda o que deve ser pintado: evita redesenhar o mapa à toa. */
export function assinaturaDasRuas(pontos, agora = new Date()) {
  const partes = [];
  for (const ponto of pontos) {
    const nivel = nivelDaRua(ponto, agora);
    if (nivel) partes.push(`${ponto.id}:${nivel}`);
  }
  return partes.join("|");
}

/**
 * As ruas afetadas em GeoJSON, para o mapa. Uma feição por bueiro, com o nível (3 ou 4).
 * As de nível alto vêm antes, para as críticas serem desenhadas por cima onde os trechos se cruzam.
 */
export function ruasParaGeoJson(pontos, agora = new Date()) {
  const features = [];
  for (const ponto of pontos) {
    const nivel = nivelDaRua(ponto, agora);
    if (!nivel) continue;
    const linhas = trechoDoBueiro(ponto);
    if (linhas.length === 0) continue;
    features.push({ type: "Feature", geometry: { type: "MultiLineString", coordinates: linhas }, properties: { nivel, ponto: ponto.id } });
  }
  features.sort((a, b) => a.properties.nivel - b.properties.nivel);
  return { type: "FeatureCollection", features };
}
