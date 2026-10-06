// Monta o estilo do mapa (formato MapLibre) com as cores do tema do SIMA.
//
// Os tiles vêm de um servidor no esquema OpenMapTiles (padrão: OpenFreeMap, definido em
// src/config.js). O desenho — o que aparece, em que cor e em que zoom — é todo daqui.
// As cores do mapa NÃO ficam neste arquivo: são lidas dos tokens --map-* do CSS
// (src/estilos/base.css), então o mapa acompanha o tema noturno/claro sem ter uma segunda
// paleta para manter. A única exceção são as manchas do modo calor (ver CALOR abaixo).
//
// Regras do desenho, as mesmas dos grandes apps de mapa:
// - O fundo é neutro (terreno e ruas em cinza) para os bueiros serem a única coisa colorida.
// - Só a água é azul. Rios e córregos ficam bem visíveis: é deles que o app trata.
// - A importância da via aparece pela largura, pela claridade e pelo zoom em que ela entra:
//   de longe só as expressas e avenidas; as ruas de bairro surgem ao aproximar.
// - Nomes discretos, com contorno na cor do terreno para continuarem legíveis sobre as ruas.
//
// O estilo também carrega os pontos do SIMA (fonte "pontos") para o modo calor. Como tudo é
// declarado aqui, MapaBase só precisa chamar setStyle de novo quando tema, pontos ou modo mudam;
// o MapLibre compara com o estilo anterior e aplica só a diferença.

import { CONFIG } from "../config.js";

const TOKENS = {
  fundo: "--map-block",
  predio: "--map-block-2",
  parque: "--map-park",
  rua: "--map-street",
  avenida: "--map-avenue",
  expressa: "--map-motorway",
  contorno: "--map-casing",
  agua: "--map-water",
  rio: "--map-water-2",
  rotuloAgua: "--map-water-label",
  rotulo: "--map-label",
  rotuloForte: "--map-label-2",
  trilho: "--map-dash",
  rota: "--map-route",
  rotaContorno: "--map-route-casing",
  rotaOutra: "--map-route-alt",
};

// Cores das manchas do modo calor. São as mesmas nos dois temas, como no desenho: as cores de
// risco do tema claro são escuras (feitas para texto) e virariam manchas apagadas no mapa.
const CALOR = { 1: "#62c9b0", 2: "#ead04e", 3: "#f58a2b", 4: "#f0508c" };

/** Lê as cores do tema em vigor. Chamar depois que a classe do tema já está no <html>. */
export function lerCoresDoTema() {
  const css = getComputedStyle(document.documentElement);
  const cores = {};
  for (const [nome, token] of Object.entries(TOKENS)) cores[nome] = css.getPropertyValue(token).trim() || "#888888";
  return cores;
}

/** Transforma os pontos em GeoJSON para a camada de calor. Só entram pontos com nível. */
export function pontosParaGeoJson(pontos) {
  return {
    type: "FeatureCollection",
    features: pontos
      .filter((p) => p.nivel)
      .map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { id: p.id, nivel: p.nivel },
      })),
  };
}

/**
 * Transforma a rota em GeoJSON para o mapa: o caminho em destaque, a outra opção (quando existe),
 * a partida e a chegada. Sem rota, devolve uma coleção vazia.
 * @param {{ ativa: Array, outra?: Array, origem: [number, number], destino: [number, number] }|null} rota
 */
export function rotaParaGeoJson(rota) {
  const features = [];
  if (rota?.ativa?.length) {
    const linha = (papel, coordinates) => ({ type: "Feature", geometry: { type: "LineString", coordinates }, properties: { papel } });
    const ponto = (papel, coordinates) => ({ type: "Feature", geometry: { type: "Point", coordinates }, properties: { papel } });
    if (rota.outra?.length) features.push(linha("outra", rota.outra));
    features.push(linha("ativa", rota.ativa), ponto("origem", rota.origem), ponto("destino", rota.destino));
  }
  return { type: "FeatureCollection", features };
}

const LINHA = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const AREA = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
const classe = (...nomes) => ["match", ["get", "class"], nomes, true, false];
const largura = (base, ...paradas) => ["interpolate", ["exponential", base], ["zoom"], ...paradas];
const NOME = ["coalesce", ["get", "name:pt"], ["get", "name:latin"], ["get", "name"]];

/**
 * @param {object} cores           resultado de lerCoresDoTema()
 * @param {object} opcoes
 * @param {object} opcoes.geojson  pontos do SIMA (pontosParaGeoJson)
 * @param {boolean} opcoes.calor   true mostra as manchas de calor
 * @param {object} opcoes.rota     rota a desenhar (rotaParaGeoJson)
 */
export function montarEstilo(cores, { geojson, calor = false, rota } = {}) {
  const papel = (nome) => ["==", ["get", "papel"], nome];
  const larguraDaRota = largura(1.3, 9, 3.5, 14, 6, 18, 12);
  // Cada tipo de via: quais classes, a cor, em que zoom entra, a largura por zoom e, nas maiores,
  // a partir de que zoom ganha contorno (antes disso a via é fina demais e o contorno a apagaria).
  // A ordem é da menor para a maior, para as avenidas ficarem por cima das ruas.
  const VIAS = [
    { id: "servico", classes: ["service"], cor: cores.rua, zoom: 14.5, largura: largura(1.5, 14.5, 0.5, 17, 3, 19, 10) },
    { id: "ruas", classes: ["minor"], cor: cores.rua, zoom: 13, largura: largura(1.5, 13, 0.6, 15, 4, 19, 22) },
    { id: "ruas-medias", classes: ["tertiary"], cor: cores.avenida, zoom: 12, largura: largura(1.45, 12, 0.8, 14, 3.6, 19, 26), contorno: 14 },
    { id: "ruas-grandes", classes: ["secondary"], cor: cores.avenida, zoom: 10.5, largura: largura(1.45, 10.5, 0.7, 14, 4.6, 19, 28), contorno: 13.5 },
    { id: "avenidas", classes: ["primary", "trunk"], cor: cores.avenida, zoom: 8.5, largura: largura(1.4, 8.5, 0.7, 11, 1.4, 14, 6, 19, 34), contorno: 12.5 },
    { id: "expressas", classes: ["motorway"], cor: cores.expressa, zoom: 6, largura: largura(1.4, 6, 0.8, 11, 2, 14, 7, 19, 38), contorno: 11.5 },
  ];
  const via = ({ id, classes, cor, zoom, largura: larguraLinha }, sufixo = "", pintura = {}) => ({
    id: id + sufixo,
    type: "line",
    source: "base",
    "source-layer": "transportation",
    minzoom: zoom,
    filter: ["all", LINHA, classe(...classes)],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": cor, "line-width": larguraLinha, ...pintura },
  });
  // Contorno: a mesma linha um pouco mais larga, desenhada por baixo. Separa a via do terreno
  // (no tema claro a rua é branca sobre cinza muito claro) sem precisar de cor.
  const contornos = VIAS.filter((v) => v.contorno).map((v) =>
    via({ ...v, cor: cores.contorno, zoom: v.contorno }, "-contorno", {
      "line-gap-width": v.largura, "line-width": 1,
      "line-opacity": ["interpolate", ["linear"], ["zoom"], v.contorno, 0, v.contorno + 1, 1],
    }));

  const texto = (extra) => ({ "text-color": cores.rotulo, "text-halo-color": cores.fundo, "text-halo-width": 1.4, ...extra });
  const corPorNivel = ["match", ["get", "nivel"], 1, CALOR[1], 2, CALOR[2], 3, CALOR[3], 4, CALOR[4], CALOR[1]];
  const visivel = calor ? "visible" : "none";

  return {
    version: 8,
    name: "SIMA",
    glyphs: CONFIG.mapa.urlGlifos,
    sources: {
      base: { type: "vector", url: CONFIG.mapa.urlTiles },
      pontos: { type: "geojson", data: geojson ?? { type: "FeatureCollection", features: [] } },
      rota: { type: "geojson", data: rota ?? { type: "FeatureCollection", features: [] } },
    },
    layers: [
      { id: "fundo", type: "background", paint: { "background-color": cores.fundo } },

      // Verde: parques e matas, bem suave.
      { id: "matas", type: "fill", source: "base", "source-layer": "landcover", filter: ["all", AREA, classe("wood", "grass")],
        paint: { "fill-color": cores.parque, "fill-opacity": 0.55 } },
      { id: "parques", type: "fill", source: "base", "source-layer": "park", filter: AREA, paint: { "fill-color": cores.parque } },

      // Água. Rios e córregos (linhas) vão num azul mais vivo para aparecerem mesmo finos; ficam
      // por baixo das áreas de água, que cobrem o trecho em que os dois se sobrepõem. Os rios
      // aparecem já na visão da cidade inteira (Tietê, Pinheiros, Tamanduateí); os córregos entram
      // ao aproximar, para não virar um emaranhado.
      { id: "rios", type: "line", source: "base", "source-layer": "waterway", filter: ["all", LINHA, classe("river", "canal")],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cores.rio, "line-opacity": 0.9, "line-width": largura(1.4, 8, 1, 11, 1.6, 14, 3, 18, 12) } },
      { id: "corregos", type: "line", source: "base", "source-layer": "waterway", minzoom: 11.5,
        filter: ["all", LINHA, ["!", classe("river", "canal")]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cores.rio, "line-opacity": ["interpolate", ["linear"], ["zoom"], 11.5, 0, 12.5, 0.6, 14, 0.85],
          "line-width": largura(1.4, 11.5, 0.6, 14, 1.6, 18, 8) } },
      { id: "agua", type: "fill", source: "base", "source-layer": "water", filter: AREA, paint: { "fill-color": cores.agua } },

      { id: "predios", type: "fill", source: "base", "source-layer": "building", minzoom: 15,
        paint: { "fill-color": cores.predio, "fill-opacity": ["interpolate", ["linear"], ["zoom"], 15, 0, 16, 0.8] } },

      // Vias: primeiro todos os contornos, depois os miolos, para os cruzamentos se fundirem.
      ...contornos,
      ...VIAS.map((v) => via(v)),
      { id: "trilhos", type: "line", source: "base", "source-layer": "transportation", minzoom: 12,
        filter: ["all", LINHA, classe("rail", "transit")],
        paint: { "line-color": cores.trilho, "line-width": 1.2, "line-dasharray": [4, 3] } },

      // Manchas de calor: um círculo esfumado por ponto, na cor do nível.
      { id: "calor-halo", type: "circle", source: "pontos", layout: { visibility: visivel },
        paint: { "circle-color": corPorNivel, "circle-blur": 1, "circle-opacity": 0.5,
          "circle-radius": largura(1.6, 10, 22, 13, 70, 16, 190) } },
      { id: "calor-nucleo", type: "circle", source: "pontos", layout: { visibility: visivel },
        paint: { "circle-color": corPorNivel, "circle-blur": 0.6, "circle-opacity": 0.75,
          "circle-radius": largura(1.6, 10, 6, 13, 18, 16, 46) } },

      // Rota: a outra opção em cinza por baixo; a escolhida em azul, com contorno para destacar
      // das ruas; a partida é um anel e a chegada um ponto cheio.
      { id: "rota-outra", type: "line", source: "rota", filter: papel("outra"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cores.rotaOutra, "line-width": largura(1.3, 9, 2.5, 14, 4.5, 18, 9), "line-opacity": 0.85 } },
      { id: "rota-contorno", type: "line", source: "rota", filter: papel("ativa"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cores.rotaContorno, "line-width": larguraDaRota, "line-opacity": 0.9 } },
      { id: "rota", type: "line", source: "rota", filter: papel("ativa"), layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": cores.rota, "line-width": largura(1.3, 9, 2.2, 14, 4.2, 18, 9) } },
      { id: "rota-origem", type: "circle", source: "rota", filter: papel("origem"),
        paint: { "circle-radius": 6, "circle-color": cores.rotaContorno, "circle-stroke-width": 3, "circle-stroke-color": cores.rota } },
      { id: "rota-destino", type: "circle", source: "rota", filter: papel("destino"),
        paint: { "circle-radius": 7, "circle-color": cores.rota, "circle-stroke-width": 3, "circle-stroke-color": cores.rotaContorno } },

      // Nomes. Água em itálico azul; ruas e bairros em cinza; cidades um tom mais forte.
      { id: "nomes-corregos", type: "symbol", source: "base", "source-layer": "waterway", minzoom: 13, filter: LINHA,
        layout: { "symbol-placement": "line", "symbol-spacing": 350, "text-field": NOME, "text-font": ["Noto Sans Italic"],
          "text-size": 12, "text-letter-spacing": 0.12 },
        paint: texto({ "text-color": cores.rotuloAgua }) },
      { id: "nomes-represas", type: "symbol", source: "base", "source-layer": "water_name", minzoom: 9,
        layout: { "text-field": NOME, "text-font": ["Noto Sans Italic"], "text-max-width": 7,
          "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 14, 13.5], "text-letter-spacing": 0.06 },
        paint: { "text-color": cores.rotuloAgua, "text-halo-color": cores.agua, "text-halo-width": 1.2 } },
      { id: "nomes-ruas", type: "symbol", source: "base", "source-layer": "transportation_name", minzoom: 15,
        filter: ["all", LINHA, classe("minor", "service", "tertiary")],
        layout: { "symbol-placement": "line", "text-field": NOME, "text-font": ["Noto Sans Regular"], "text-size": 11.5 },
        paint: texto() },
      { id: "nomes-avenidas", type: "symbol", source: "base", "source-layer": "transportation_name", minzoom: 12.5,
        filter: ["all", LINHA, classe("secondary", "primary", "trunk", "motorway")],
        layout: { "symbol-placement": "line", "text-field": NOME, "text-font": ["Noto Sans Regular"],
          "text-size": ["interpolate", ["linear"], ["zoom"], 12.5, 10.5, 16, 13], "text-letter-spacing": 0.02 },
        paint: texto() },
      { id: "nomes-bairros", type: "symbol", source: "base", "source-layer": "place", minzoom: 11, maxzoom: 16,
        filter: classe("suburb", "neighbourhood", "quarter"),
        layout: { "text-field": NOME, "text-font": ["Noto Sans Bold"], "text-transform": "uppercase", "text-max-width": 8,
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 12.5], "text-letter-spacing": 0.1 },
        paint: texto() },
      { id: "nomes-cidades", type: "symbol", source: "base", "source-layer": "place", maxzoom: 11,
        filter: classe("city", "town"),
        layout: { "text-field": NOME, "text-font": ["Noto Sans Bold"], "text-size": 14, "text-max-width": 8 },
        paint: texto({ "text-color": cores.rotuloForte }) },
    ],
  };
}
