// Agrupa pontos que ficariam uns em cima dos outros no mapa afastado.
//
// Com mais de cem bueiros, a cidade inteira na tela vira um borrão de tampas sobrepostas. Aqui os
// pontos que estão a menos de `raio` pixels uns dos outros (no zoom atual) viram um grupo só, que o
// mapa desenha como uma tampa com a pior situação do grupo e a quantidade de bueiros.
//
// O agrupamento depende só da POSIÇÃO e do zoom, nunca do nível de risco. Assim, quando o clima
// muda, as tampas mudam de cor no lugar em vez de pular de um grupo para outro.

/** Posição de um lugar em pixels num dado zoom (projeção de Mercator, a mesma do mapa). */
export function pixelNoZoom(lon, lat, zoom) {
  const escala = 512 * 2 ** zoom;
  const seno = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lon + 180) / 360) * escala,
    y: (0.5 - Math.log((1 + seno) / (1 - seno)) / (4 * Math.PI)) * escala,
  };
}

/**
 * @param {Array<{id: string, lon: number, lat: number}>} pontos
 * @param {number} zoom           zoom atual do mapa
 * @param {object} [opcoes]
 * @param {number} [opcoes.raio]  distância em pixels abaixo da qual dois pontos se juntam
 * @param {string} [opcoes.sozinho] id de um ponto que nunca entra em grupo (o selecionado)
 * @returns {Array<{ chave: string, lon: number, lat: number, membros: object[] }>}
 *   Um item por marcador a desenhar. Grupo de um membro só é um ponto comum.
 */
export function agruparPontos(pontos, zoom, { raio = 36, sozinho = null } = {}) {
  const posicoes = pontos.map((p) => pixelNoZoom(p.lon, p.lat, zoom));
  const usado = new Array(pontos.length).fill(false);
  const grupos = [];

  for (let i = 0; i < pontos.length; i += 1) {
    if (usado[i]) continue;
    usado[i] = true;
    const indices = [i];
    if (pontos[i].id !== sozinho) {
      for (let j = i + 1; j < pontos.length; j += 1) {
        if (usado[j] || pontos[j].id === sozinho) continue;
        if (Math.hypot(posicoes[i].x - posicoes[j].x, posicoes[i].y - posicoes[j].y) <= raio) {
          usado[j] = true;
          indices.push(j);
        }
      }
    }
    const membros = indices.map((k) => pontos[k]);
    grupos.push({
      chave: membros.length === 1 ? `p${membros[0].id}` : `g${membros[0].id}-${membros.length}`,
      lon: membros.reduce((soma, p) => soma + p.lon, 0) / membros.length,
      lat: membros.reduce((soma, p) => soma + p.lat, 0) / membros.length,
      membros,
    });
  }
  return grupos;
}
