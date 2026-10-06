// O mapa em si: MapLibre GL com o estilo do SIMA, as tampas como marcadores e a rota.
//
// Este componente só desenha. Quem decide qual ponto está selecionado, qual é o modo e o que
// fazer ao tocar é a tela Mapa (src/telas/Mapa.jsx).
//
// A tela informa, por `medirAreaLivre`, quanto do mapa está coberto pelos controles e pelo cartão.
//
// Comandos disponíveis pela ref:
//   voarPara(lon, lat, zoom?)   centraliza num lugar
//   mostrarPosicao(lon, lat)    desenha o ponto azul do usuário e centraliza nele
//
// Com a propriedade `rota` ({ ativa, outra, origem, destino }), desenha o caminho e enquadra o
// mapa nele, respeitando a área coberta pelos controles e pelo cartão.

import { forwardRef, useEffect, useImperativeHandle, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AttributionControl, LngLatBounds, Map as MapaLibre, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// O MapLibre 6 processa os tiles num web worker separado. O Vite empacota esse arquivo e devolve o
// endereço final dele; sem isto o worker não é encontrado depois do build.
import urlDoWorker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

import { CONFIG } from "../config";
import { Tampa } from "../componentes/Tampa";
import { corNivel, rotuloNivel } from "../dados/niveis";
import { nivelVisivel, statusAgora } from "../dados/modelo";
import { lerCoresDoTema, montarEstilo, rotaParaGeoJson } from "./estiloMapa";
import { agruparPontos } from "./agrupar.js";

setWorkerUrl(urlDoWorker);

const TEXTOS = {
  "Map.Title": "Mapa",
  "AttributionControl.ToggleAttribution": "Mostrar ou esconder os créditos do mapa",
};

export const MapaBase = forwardRef(function MapaBase(
  { pontos, agora, tema, selecionadoId, rota = null, aoTocarPonto, aoTocarFundo, medirAreaLivre },
  ref,
) {
  const caixa = useRef(null);
  const [mapa, setMapa] = useState(null);
  const [pronto, setPronto] = useState(false);
  const [falhou, setFalhou] = useState(false);
  // Zoom arredondado em passos de 0,25: é o que decide o agrupamento das tampas.
  const [zoom, setZoom] = useState(CONFIG.mapa.zoom);
  const marcadorEu = useRef(null);
  const jaEnquadrou = useRef(false);

  // As funções de toque mudam a cada desenho; o mapa é criado uma vez só e lê sempre a mais recente.
  const toques = useRef({ aoTocarFundo, medirAreaLivre });
  toques.current = { aoTocarFundo, medirAreaLivre };

  const rotaGeo = useMemo(() => rotaParaGeoJson(rota), [rota]);
  const ultimoEstilo = useRef({ rota: rotaGeo });
  ultimoEstilo.current = { rota: rotaGeo };

  // Cria o mapa uma vez.
  useEffect(() => {
    let instancia;
    try {
      instancia = new MapaLibre({
        container: caixa.current,
        style: montarEstilo(lerCoresDoTema(), ultimoEstilo.current),
        center: CONFIG.mapa.centro,
        zoom: CONFIG.mapa.zoom,
        minZoom: 9,
        maxZoom: 18.5,
        maxBounds: CONFIG.mapa.limites,
        attributionControl: false,
        locale: TEXTOS,
        // Mapa sempre com o norte para cima e visto de cima: menos gestos para errar no celular.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        maxPitch: 0,
      });
    } catch (erro) {
      console.error("[SIMA] Não foi possível criar o mapa.", erro);
      setFalhou(true);
      return undefined;
    }
    instancia.touchZoomRotate.disableRotation();
    instancia.keyboard.disableRotation();
    // Os créditos dos dados do mapa (OpenStreetMap, OpenMapTiles) são obrigatórios.
    instancia.addControl(new AttributionControl({ compact: true }), "bottom-left");
    instancia.on("load", () => setPronto(true));
    const anotarZoom = () => setZoom(Math.round(instancia.getZoom() * 4) / 4);
    instancia.on("zoom", anotarZoom);
    instancia.on("zoomend", anotarZoom);
    instancia.on("click", (evento) => {
      if (evento.originalEvent?.target?.closest?.(".mk")) return;
      toques.current.aoTocarFundo?.();
    });
    instancia.on("error", (evento) => console.warn("[SIMA] Aviso do mapa:", evento.error?.message ?? evento));
    setMapa(instancia);
    return () => {
      instancia.remove();
      setMapa(null);
      setPronto(false);
    };
  }, []);

  // Tema ou rota mudaram: remonta o estilo e o MapLibre aplica só a diferença.
  useEffect(() => {
    if (!mapa || !pronto) return;
    mapa.setStyle(montarEstilo(lerCoresDoTema(), { rota: rotaGeo }), { diff: true });
  }, [mapa, pronto, tema, rotaGeo]);

  // Rota nova: enquadra o caminho inteiro (as duas opções) na área livre do mapa.
  useEffect(() => {
    if (!mapa || !rota?.ativa?.length) return;
    const limites = new LngLatBounds();
    for (const ponto of rota.ativa) limites.extend(ponto);
    for (const ponto of rota.outra ?? []) limites.extend(ponto);
    const telaLarga = window.matchMedia("(min-width: 900px)").matches;
    const area = toques.current.medirAreaLivre?.() ?? { topo: 110, cartao: 0, coluna: 420 };
    const margem = telaLarga
      ? { top: area.topo + 30, bottom: 60, left: area.coluna + 50, right: 70 }
      : { top: area.topo + 30, bottom: area.cartao + 30, left: 44, right: 44 };
    mapa.fitBounds(limites, { padding: margem, maxZoom: 16, duration: 700 });
  }, [mapa, rota]);

  // Na primeira vez que há pontos, enquadra todos.
  useEffect(() => {
    if (!mapa || jaEnquadrou.current || pontos.length === 0) return;
    jaEnquadrou.current = true;
    if (selecionadoId) return; // abriu já num ponto: o efeito abaixo cuida da câmera
    const limites = new LngLatBounds();
    for (const p of pontos) limites.extend([p.lon, p.lat]);
    mapa.fitBounds(limites, { padding: { top: 120, bottom: 130, left: 30, right: 30 }, maxZoom: 14.5, duration: 0 });
  }, [mapa, pontos, selecionadoId]);

  // Ao selecionar um ponto, leva ele para o meio da área que sobra do mapa: entre os controles de
  // cima e o cartão (celular) ou à direita da coluna (tela larga). Sem isso, em celular pequeno o
  // ponto ficaria escondido atrás do cartão.
  const selecionado = selecionadoId ? pontos.find((p) => p.id === selecionadoId) : null;
  const lonSel = selecionado?.lon;
  const latSel = selecionado?.lat;
  useEffect(() => {
    if (!mapa || lonSel === undefined) return;
    const telaLarga = window.matchMedia("(min-width: 900px)").matches;
    const { clientWidth: larguraMapa, clientHeight: alturaMapa } = mapa.getContainer();
    const area = toques.current.medirAreaLivre?.() ?? { topo: 110, cartao: 0, coluna: 420 };
    let deslocamento;
    if (telaLarga) {
      deslocamento = [Math.min(area.coluna, larguraMapa / 2) / 2, 0];
    } else {
      const topoDoCartao = alturaMapa - area.cartao;
      const alvo = Math.min(Math.max((area.topo + topoDoCartao) / 2, area.topo + 26), topoDoCartao - 30);
      deslocamento = [0, alvo - alturaMapa / 2];
    }
    mapa.easeTo({ center: [lonSel, latSel], zoom: Math.max(mapa.getZoom(), 14), offset: deslocamento, duration: 600 });
  }, [mapa, lonSel, latSel]);

  useImperativeHandle(ref, () => ({
    voarPara(lon, lat, zoom = 15) {
      mapa?.flyTo({ center: [lon, lat], zoom, duration: 900 });
    },
    mostrarPosicao(lon, lat) {
      if (!mapa) return;
      if (!marcadorEu.current) {
        const no = document.createElement("div");
        no.className = "mk-eu";
        no.setAttribute("role", "img");
        no.setAttribute("aria-label", "Sua posição");
        marcadorEu.current = new Marker({ element: no }).setLngLat([lon, lat]).addTo(mapa);
      } else {
        marcadorEu.current.setLngLat([lon, lat]);
      }
      mapa.flyTo({ center: [lon, lat], zoom: Math.max(mapa.getZoom(), 15), duration: 900 });
    },
  }), [mapa]);

  if (falhou) {
    return (
      <div className="mp-tela" role="alert" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <p className="sub" style={{ maxWidth: 320, textAlign: "center" }}>
          Não foi possível abrir o mapa neste aparelho. A lista de bairros, no menu, mostra as mesmas informações.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* O MapLibre troca o "position" do elemento que recebe; por isso ele ganha uma caixa só dele. */}
      <div className="mp-tela"><div ref={caixa} className="mp-caixa" /></div>
      {mapa ? (
        <Marcadores mapa={mapa} pontos={pontos} agora={agora} zoom={zoom} selecionadoId={selecionadoId} aoTocar={aoTocarPonto} />
      ) : null}
    </>
  );
});

/**
 * As tampas sobre o mapa. Pontos muito próximos no zoom atual viram um grupo (ver agrupar.js).
 * Cada grupo ganha um marcador do MapLibre (que cuida da posição na tela) e o conteúdo é
 * desenhado pelo React dentro dele, com um portal.
 */
function Marcadores({ mapa, pontos, agora, zoom, selecionadoId, aoTocar }) {
  const registro = useRef(new Map()); // chave do grupo → { marcador, no }
  const [, redesenhar] = useReducer((n) => n + 1, 0);

  const grupos = useMemo(() => agruparPontos(pontos, zoom, { sozinho: selecionadoId }), [pontos, zoom, selecionadoId]);

  useEffect(() => {
    const reg = registro.current;
    const vivos = new Set(grupos.map((g) => g.chave));
    for (const [chave, item] of reg) {
      if (!vivos.has(chave)) {
        item.marcador.remove();
        reg.delete(chave);
      }
    }
    for (const g of grupos) {
      const item = reg.get(g.chave);
      if (item) {
        item.marcador.setLngLat([g.lon, g.lat]);
      } else {
        const no = document.createElement("div");
        const marcador = new Marker({ element: no, anchor: "center" }).setLngLat([g.lon, g.lat]).addTo(mapa);
        reg.set(g.chave, { marcador, no });
      }
    }
    redesenhar();
  }, [mapa, grupos]);

  // Situações mais graves ficam por cima das outras; o selecionado, por cima de todas.
  useEffect(() => {
    for (const g of grupos) {
      const item = registro.current.get(g.chave);
      if (!item) continue;
      const selecionado = g.membros.length === 1 && g.membros[0].id === selecionadoId;
      const gravidade = Math.max(...g.membros.map((p) => (p.nivel ?? 0) + (p.medicaoTransbordando ? 5 : 0)));
      item.no.style.zIndex = String(selecionado ? 30 : gravidade);
    }
  });

  useEffect(() => {
    const reg = registro.current;
    return () => {
      for (const item of reg.values()) item.marcador.remove();
      reg.clear();
    };
  }, [mapa]);

  /** Aproxima o mapa até os bueiros do grupo se separarem. */
  const abrirGrupo = (membros) => {
    const limites = new LngLatBounds();
    for (const p of membros) limites.extend([p.lon, p.lat]);
    mapa.fitBounds(limites, { padding: { top: 150, bottom: 170, left: 70, right: 70 }, maxZoom: 17, duration: 700 });
  };

  return grupos.map((g) => {
    const item = registro.current.get(g.chave);
    if (!item) return null;
    const conteudo = g.membros.length === 1
      ? <BotaoTampa ponto={g.membros[0]} agora={agora} selecionado={g.membros[0].id === selecionadoId}
          comRotulo={zoom >= 13} aoTocar={aoTocar} />
      : <BotaoGrupo membros={g.membros} agora={agora} aoTocar={abrirGrupo} />;
    return createPortal(conteudo, item.no, g.chave);
  });
}

function BotaoTampa({ ponto, agora, selecionado, comRotulo, aoTocar }) {
  const status = statusAgora(ponto, agora);
  const nivel = nivelVisivel(ponto, agora);
  const desatualizado = status === "DESATUALIZADA";
  const classes = ["mk"];
  if (selecionado) classes.push("mk-sel");
  if (desatualizado) classes.push("mk-apagado");

  let descricao = `Bueiro ${ponto.codigo}`;
  if (ponto.endereco) descricao += `, ${ponto.endereco}`;
  if (ponto.medicaoTransbordando) descricao += ", transbordando agora";
  else if (!nivel) descricao += ", sem previsão";
  else descricao += `, risco ${rotuloNivel(nivel).toLowerCase()}${desatualizado ? ", previsão desatualizada" : ""}`;

  // O código aparece ao lado dos pontos altos e críticos quando o mapa está perto, e sempre no selecionado.
  const mostraRotulo = selecionado || (comRotulo && !desatualizado && nivel >= 3);

  return (
    <button
      type="button"
      className={classes.join(" ")}
      aria-label={descricao}
      aria-pressed={selecionado}
      onClick={(evento) => {
        evento.stopPropagation();
        aoTocar?.(ponto.id);
      }}
    >
      <span className="mk-anel" aria-hidden="true" />
      {nivel === 4 && !desatualizado ? <span className="mk-pulso" aria-hidden="true" /> : null}
      <Tampa nivel={nivel} tamanho={24} />
      {mostraRotulo ? <span className="mk-rotulo" style={{ color: corNivel(nivel) }} aria-hidden="true">{ponto.codigo}</span> : null}
    </button>
  );
}

/**
 * Vários bueiros próximos: um anel que mostra QUANTOS do grupo estão em cada nível, com o total no
 * meio. Tocar aproxima o mapa até eles se separarem.
 *
 * O anel mostra a proporção (e não só o pior caso) para o mapa afastado não exagerar: um grupo de
 * 38 bueiros com 3 em nível médio aparece quase todo verde, com um trecho amarelo.
 */
function BotaoGrupo({ membros, agora, aoTocar }) {
  const contagem = [0, 0, 0, 0, 0]; // baixo, médio, alto, crítico, sem previsão
  for (const p of membros) contagem[(nivelVisivel(p, agora) ?? 5) - 1] += 1;
  const total = membros.length;

  const partes = contagem.slice(0, 4).map((n, i) => (n ? `${n} em nível ${rotuloNivel(i + 1).toLowerCase()}` : null)).filter(Boolean);
  if (contagem[4]) partes.push(`${contagem[4]} sem previsão`);
  const descricao = `${total} bueiros nesta área: ${partes.join(", ")}. Aproximar.`;

  // Cada nível vira um arco do anel, de baixo a crítico no sentido horário, a partir do topo.
  const RAIO = 16.5;
  const VOLTA = 2 * Math.PI * RAIO;
  const niveisPresentes = contagem.filter(Boolean).length;
  const folga = niveisPresentes > 1 ? 1.6 : 0;
  let inicio = 0;
  const arcos = contagem.map((n, i) => {
    if (!n) return null;
    const tamanho = (n / total) * VOLTA;
    const arco = (
      <circle key={i} cx="22" cy="22" r={RAIO} fill="none" strokeWidth="5.5" transform="rotate(-90 22 22)"
        strokeDasharray={`${Math.max(1, tamanho - folga)} ${VOLTA}`} strokeDashoffset={-inicio}
        style={{ stroke: i < 4 ? `var(--r${i + 1})` : "var(--bone-500)" }} />
    );
    inicio += tamanho;
    return arco;
  });

  return (
    <button
      type="button"
      className="mk mk-grupo"
      aria-label={descricao}
      onClick={(evento) => {
        evento.stopPropagation();
        aoTocar(membros);
      }}
    >
      {contagem[3] ? <span className="mk-pulso" aria-hidden="true" /> : null}
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
        <circle cx="22" cy="22" r="20" style={{ fill: "var(--lid-bg)" }} />
        {arcos}
        <text x="22" y="26.5" textAnchor="middle" className="mk-total">{total}</text>
      </svg>
    </button>
  );
}
