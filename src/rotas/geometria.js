// Contas de geometria usadas pelas rotas. Tudo em [longitude, latitude] e metros.
// As distâncias usam uma aproximação plana (boa para trechos de poucos quilômetros, como os de
// uma cidade): 1 grau de latitude vale ~111 km e 1 grau de longitude encolhe com o cosseno dela.

const METROS_POR_GRAU = 111320;
const paraRad = (graus) => (graus * Math.PI) / 180;

/**
 * Abre o traçado que o serviço de rotas devolve compactado ("polyline" com 6 casas decimais).
 * @returns {Array<[number, number]>} lista de [longitude, latitude]
 */
export function decodificarPolilinha(texto, casas = 6) {
  const fator = 10 ** casas;
  const caminho = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  while (i < texto.length) {
    for (const eixo of ["lat", "lon"]) {
      let resultado = 0;
      let deslocamento = 0;
      let byte;
      do {
        byte = texto.charCodeAt(i++) - 63;
        resultado |= (byte & 31) << deslocamento;
        deslocamento += 5;
      } while (byte >= 32);
      const delta = resultado & 1 ? ~(resultado >> 1) : resultado >> 1;
      if (eixo === "lat") lat += delta;
      else lon += delta;
    }
    caminho.push([lon / fator, lat / fator]);
  }
  return caminho;
}

/** Distância em metros entre dois pontos. */
export function metros([lonA, latA], [lonB, latB]) {
  const x = (lonB - lonA) * Math.cos(paraRad((latA + latB) / 2)) * METROS_POR_GRAU;
  const y = (latB - latA) * METROS_POR_GRAU;
  return Math.hypot(x, y);
}

/** Menor distância, em metros, de um ponto até um caminho (lista de [lon, lat]). */
export function distanciaAteCaminho(ponto, caminho) {
  if (!caminho || caminho.length === 0) return Infinity;
  const escalaX = Math.cos(paraRad(ponto[1])) * METROS_POR_GRAU;
  // Passa tudo para metros com o ponto na origem; aí é distância de ponto a segmento.
  const emMetros = (p) => [(p[0] - ponto[0]) * escalaX, (p[1] - ponto[1]) * METROS_POR_GRAU];
  let menor = Infinity;
  let [ax, ay] = emMetros(caminho[0]);
  if (caminho.length === 1) return Math.hypot(ax, ay);
  for (let i = 1; i < caminho.length; i++) {
    const [bx, by] = emMetros(caminho[i]);
    // Caixa do segmento longe demais para melhorar o resultado: pula a conta.
    if (!(Math.min(ax, bx) > menor || Math.max(ax, bx) < -menor || Math.min(ay, by) > menor || Math.max(ay, by) < -menor)) {
      const dx = bx - ax;
      const dy = by - ay;
      const tamanho2 = dx * dx + dy * dy;
      const t = tamanho2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / tamanho2));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d < menor) menor = d;
    }
    ax = bx;
    ay = by;
  }
  return menor;
}

/**
 * Quadrado em volta de um ponto, com os lados a `folga` metros dele, fechado (o último vértice
 * repete o primeiro), como o serviço de rotas espera. É quadrado, e não um círculo aproximado,
 * porque o serviço limita o número total de vértices das áreas a evitar: com menos vértices por
 * área cabem mais bueiros no mesmo pedido.
 */
export function quadradoEmVolta([lon, lat], folga) {
  const dLat = folga / METROS_POR_GRAU;
  const dLon = folga / (METROS_POR_GRAU * Math.cos(paraRad(lat)));
  const canto = (sx, sy) => [Number((lon + sx * dLon).toFixed(6)), Number((lat + sy * dLat).toFixed(6))];
  const anel = [canto(-1, -1), canto(1, -1), canto(1, 1), canto(-1, 1)];
  anel.push(anel[0]);
  return anel;
}

/** Perímetro de um anel, em metros. */
export function perimetro(anel) {
  let total = 0;
  for (let i = 1; i < anel.length; i++) total += metros(anel[i - 1], anel[i]);
  return total;
}

/** Caixa que contém o caminho: [[oeste, sul], [leste, norte]]. */
export function limitesDoCaminho(caminho) {
  let oeste = Infinity;
  let sul = Infinity;
  let leste = -Infinity;
  let norte = -Infinity;
  for (const [lon, lat] of caminho) {
    if (lon < oeste) oeste = lon;
    if (lon > leste) leste = lon;
    if (lat < sul) sul = lat;
    if (lat > norte) norte = lat;
  }
  return [[oeste, sul], [leste, norte]];
}
