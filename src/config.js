// Tudo o que muda de ambiente para ambiente. Defina no arquivo .env.local (veja .env.example).
// Sem configuração nenhuma o app abre com os dados de demonstração.

// Fora do Vite (testes com node --test) import.meta.env não existe.
const env = import.meta.env ?? {};

// `npm run demo` (ou VITE_DEMO=1) força a demonstração mesmo com um backend configurado no
// .env.local. É o modo para apresentar o projeto.
const forcarDemo = env.MODE === "demo" || env.VITE_DEMO === "1";

export const CONFIG = {
  /** Base do backend (ex.: /api ou http://localhost:8080). Vazio = dados de demonstração. */
  urlApi: forcarDemo ? "" : (env.VITE_API_URL || "").replace(/\/$/, ""),

  /** De quanto em quanto tempo o app consulta as previsões de novo. O backend recalcula a cada 10 min. */
  intervaloAtualizacaoMs: Number(env.VITE_INTERVALO_S || 90) * 1000,

  /** Quanto esperar pela resposta do backend antes de desistir. */
  tempoLimiteMs: 6000,

  /** Janela da previsão do modelo de IA, em horas. Usada quando a resposta não informa. */
  janelaHorasPadrao: 3,

  mapa: {
    /** TileJSON dos tiles vetoriais (esquema OpenMapTiles). Padrão: OpenFreeMap, gratuito e sem chave. */
    urlTiles: env.VITE_MAPA_TILES || "https://tiles.openfreemap.org/planet",
    /** Fontes dos nomes de rua no mapa. */
    urlGlifos: env.VITE_MAPA_GLIFOS || "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    /** Onde o mapa abre quando ainda não há pontos: centro de São Paulo. [longitude, latitude] */
    centro: [-46.635, -23.545],
    zoom: 10.5,
    /** Limites de navegação: Grande São Paulo. [[oeste, sul], [leste, norte]] */
    limites: [[-47.2, -24.1], [-46.0, -23.1]],
  },
};
