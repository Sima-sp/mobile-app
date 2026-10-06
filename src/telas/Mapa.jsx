// Tela principal: o mapa de risco. Fica sempre montada; as outras telas abrem por cima dela.
//
// O que tem aqui: botão de menu, controles do mapa (calor e "onde estou"), avisos sobre a origem
// dos dados, a barra de busca em vidro e o cartão que sobe quando um bueiro é tocado.
// O ponto selecionado fica no endereço (/?ponto=ID), então dá para abrir o app direto num bueiro
// por um link. Tocar em outro ponto troca o endereço sem empilhar histórico.

import { useEffect, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate, useSearchParams } from "react-router";
import { MapaBase } from "../mapa/MapaBase";
import { usePontos } from "../dados/PontosContexto";
import { usePreferencias } from "../preferencias/PreferenciasContexto";
import { corNivel } from "../dados/niveis";
import { fatosDoCartao, horaCurta, linhaSituacao, nivelVisivel } from "../dados/modelo";
import { useTelaLarga } from "../componentes/ganchos";
import { useArrastarVertical } from "../componentes/arrastar";
import { useEsc } from "../componentes/Tela";
import {
  IconeBusca, IconeCamadas, IconeChuva, IconeChuvisco, IconeFechar, IconeLocalizar, IconeMenu, IconePessoa, IconeRota,
  IconeSol, IconeTempestade,
} from "../componentes/Icones";

const ICONE_DO_CLIMA = { sol: IconeSol, chuvisco: IconeChuvisco, "chuva-forte": IconeChuva, "chuva-extrema": IconeTempestade };

export default function Mapa() {
  const { pontos, agora, fonte, erro, carregando, simulacao, atualizadoEm, atualizar, demo } = usePontos();
  const { tema, abrirEmCalor } = usePreferencias();
  const navegar = useNavigate();
  const local = useLocation();
  const [parametros] = useSearchParams();
  const rotaBueiro = useMatch("/bueiro/:id");
  const telaLarga = useTelaLarga();
  const mapaRef = useRef(null);
  const topoRef = useRef(null);
  const cartaoRef = useRef(null);
  const barraRef = useRef(null);

  const [calor, setCalor] = useState(abrirEmCalor);
  const [recado, setRecado] = useState(null);

  const naRaiz = local.pathname === "/";
  // Com a tela de um bueiro aberta ao lado (tela larga), o mesmo ponto fica marcado no mapa.
  const idSelecionado = naRaiz ? parametros.get("ponto") : rotaBueiro?.params.id ?? null;
  const selecionado = idSelecionado ? pontos.find((p) => p.id === idSelecionado) ?? null : null;
  const cartaoAberto = naRaiz && Boolean(selecionado);

  // Guarda o último ponto para o cartão não ficar vazio enquanto desce.
  const ultimo = useRef(null);
  if (selecionado && naRaiz) ultimo.current = selecionado;

  // Recados passageiros (ex.: localização negada) somem sozinhos.
  useEffect(() => {
    if (!recado) return undefined;
    const relogio = setTimeout(() => setRecado(null), 6000);
    return () => clearTimeout(relogio);
  }, [recado]);

  const selecionar = (id) => navegar({ pathname: "/", search: `?ponto=${encodeURIComponent(id)}` }, { replace: naRaiz });
  const fecharCartao = () => {
    if (cartaoAberto) navegar("/", { replace: true });
  };

  useEsc(fecharCartao, cartaoAberto); // Esc fecha o cartão

  // O cartão acompanha o dedo, como as folhas do iPhone: puxar para baixo fecha; puxar para cima
  // abre a tela completa do bueiro; um arrasto curto volta ao lugar.
  useArrastarVertical(cartaoRef, {
    ativo: cartaoAberto,
    aoSoltar: ({ dy, velocidade }) => {
      if (dy > 80 || velocidade > 0.5) fecharCartao();
      else if ((dy < -56 || velocidade < -0.5) && selecionado) navegar(`/bueiro/${encodeURIComponent(selecionado.id)}`);
    },
  });
  // A barra de busca tem um pegador: puxá-la para cima abre a busca.
  useArrastarVertical(barraRef, {
    ativo: naRaiz && !cartaoAberto,
    resistenciaBaixo: 0.2,
    aoSoltar: ({ dy, velocidade }) => {
      if (dy < -36 || velocidade < -0.45) navegar("/busca");
    },
  });

  // Na demonstração, as teclas 1 a 4 trocam o clima (útil para quem apresenta pelo computador).
  const climas = demo?.climas;
  const definirClima = demo?.definirClima;
  useEffect(() => {
    if (!climas || !naRaiz) return undefined;
    const aoApertar = (evento) => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(evento.target?.tagName ?? "");
      if (digitando || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      const escolhido = climas[Number(evento.key) - 1];
      if (escolhido) definirClima(escolhido.id);
    };
    document.addEventListener("keydown", aoApertar);
    return () => document.removeEventListener("keydown", aoApertar);
  }, [climas, definirClima, naRaiz]);

  function localizar() {
    if (!navigator.geolocation) {
      setRecado("Este aparelho não informa a localização.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => mapaRef.current?.mostrarPosicao(posicao.coords.longitude, posicao.coords.latitude),
      (falha) => setRecado(falha.code === 1
        ? "Localização não permitida. Libere o acesso nas configurações do navegador."
        : "Não foi possível obter sua localização agora."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }

  // No celular, com outra tela por cima, o mapa sai do alcance do teclado e do leitor de tela.
  const coberto = !naRaiz && !telaLarga;

  return (
    <section className="mp" aria-label="Mapa de risco" inert={coberto}>
      <MapaBase
        ref={mapaRef}
        pontos={pontos}
        agora={agora}
        tema={tema}
        calor={calor}
        selecionadoId={selecionado?.id ?? null}
        aoTocarPonto={selecionar}
        aoTocarFundo={fecharCartao}
        medirAreaLivre={() => ({
          topo: topoRef.current?.getBoundingClientRect().bottom ?? 110,
          cartao: (cartaoRef.current?.offsetHeight ?? 0) + 16,
          coluna: 420,
        })}
      />

      <div className="mp-top" ref={topoRef}>
        <div className="mp-esq">
          <div className="mp-linha">
            <button type="button" className="lg lg-round" onClick={() => navegar("/menu")} aria-label="Abrir menu e configurações">
              <IconeMenu />
            </button>
            {demo ? <SeletorDeClima demo={demo} /> : null}
          </div>
          <Avisos fonte={fonte} erro={erro} carregando={carregando} simulacao={simulacao} atualizadoEm={atualizadoEm}
            temPontos={pontos.length > 0} aoTentarDeNovo={atualizar} demo={demo} />
          {calor ? (
            <div className="lg mp-legend" role="group" aria-label="Legenda do mapa de calor">
              <span><i style={{ background: "var(--r1)" }} />Baixo</span>
              <span><i style={{ background: "var(--r2)" }} />Médio</span>
              <span><i style={{ background: "var(--r3)" }} />Alto</span>
              <span><i style={{ background: "var(--r4)" }} />Crítico</span>
            </div>
          ) : null}
          {recado ? <p className="lg mp-aviso" role="status">{recado}</p> : null}
        </div>

        <div className="lg lg-caps" role="group" aria-label="Controles do mapa">
          <button type="button" className={calor ? "mp-caps-on" : undefined} onClick={() => setCalor((c) => !c)}
            aria-pressed={calor} aria-label="Mapa de calor">
            <IconeCamadas />
          </button>
          <button type="button" onClick={localizar} aria-label="Centralizar em mim">
            <IconeLocalizar />
          </button>
        </div>
      </div>

      <div ref={barraRef} className={`lg mbar ${cartaoAberto ? "mbar-oculta" : ""}`} inert={cartaoAberto}>
        <span className="grabber" aria-hidden="true" />
        <button type="button" className="mbar-field" onClick={() => navegar("/busca")} aria-label="Buscar bueiro ou bairro">
          <IconeBusca />
          <span className="mbar-ph">Buscar no mapa</span>
        </button>
        <button type="button" className="mbar-av" onClick={() => navegar("/perfil")} aria-label="Perfil">
          <IconePessoa />
        </button>
      </div>

      <CartaoBueiro refCartao={cartaoRef} ponto={ultimo.current} aberto={cartaoAberto} agora={agora} aoFechar={fecharCartao}
        aoVerBueiro={(id) => navegar(`/bueiro/${encodeURIComponent(id)}`)} aoVerRotas={() => navegar("/rotas")} />
    </section>
  );
}

/** Diz de onde vêm os dados quando isso importa: demonstração, simulação ou falta de conexão. */
function Avisos({ fonte, erro, carregando, simulacao, atualizadoEm, temPontos, aoTentarDeNovo, demo }) {
  if (fonte === "demo") {
    const clima = demo?.climas.find((c) => c.id === demo.clima);
    return (
      <p className="lg mp-aviso" role="status">
        <span className="mp-aviso-dot" aria-hidden="true" />Demonstração{clima ? ` · ${clima.rotulo.toLowerCase()}` : " · dados de exemplo"}
      </p>
    );
  }
  if (erro) {
    const texto = temPontos && atualizadoEm ? `Sem conexão · dados das ${horaCurta(atualizadoEm)}` : "Sem conexão com o servidor";
    return (
      <button type="button" className="lg mp-aviso mp-aviso-erro" onClick={aoTentarDeNovo} role="alert">
        <span className="mp-aviso-dot" aria-hidden="true" />{texto} · tentar de novo
      </button>
    );
  }
  if (carregando && !temPontos) {
    return <p className="lg mp-aviso" role="status"><span className="mp-aviso-dot" aria-hidden="true" />Carregando os bueiros…</p>;
  }
  if (simulacao) {
    return <p className="lg mp-aviso mp-aviso-simulacao"><span className="mp-aviso-dot" aria-hidden="true" />Simulação · chuva de teste ligada</p>;
  }
  if (!carregando && !temPontos) {
    return <p className="lg mp-aviso"><span className="mp-aviso-dot" aria-hidden="true" />Nenhum bueiro monitorado ainda</p>;
  }
  return null;
}

/**
 * Controle do clima da demonstração: quatro botões, um por condição. Só existe sem backend.
 * Há sempre um marcado; as teclas 1 a 4 fazem o mesmo que os botões.
 */
function SeletorDeClima({ demo }) {
  return (
    <div className="lg mp-clima" role="group" aria-label="Clima da demonstração">
      {demo.climas.map((clima, indice) => {
        const Icone = ICONE_DO_CLIMA[clima.id];
        const marcado = clima.id === demo.clima;
        return (
          <button key={clima.id} type="button" aria-pressed={marcado} aria-label={clima.rotulo}
            title={`${clima.rotulo} (tecla ${indice + 1})`} className={marcado ? "mp-clima-on" : undefined}
            onClick={() => demo.definirClima(clima.id)}>
            <Icone />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Cartão que sobe ao tocar num bueiro, no padrão dos apps de mapa: nome e situação em cima, uma
 * faixa com os três números que importam e os botões de ação embaixo.
 * Na faixa, água e lixo são MEDIDOS pelo sensor; a chance de alagar é PREVISTA pela IA.
 * O botão azul é a ação principal. Quando as rotas ficarem prontas, "Desviar" passa a ser o azul.
 */
function CartaoBueiro({ refCartao, ponto, aberto, agora, aoFechar, aoVerBueiro, aoVerRotas }) {
  if (!ponto) return null;
  const nivel = nivelVisivel(ponto, agora);
  const fatos = fatosDoCartao(ponto, agora);

  return (
    <section ref={refCartao} className={`lg lg-strong ms ${aberto ? "" : "ms-fechado"}`} aria-label="Bueiro selecionado" inert={!aberto}>
      <span className="grabber" aria-hidden="true" />
      <div className="ms-head">
        <div style={{ minWidth: 0 }}>
          <h2 className="ms-title">Bueiro {ponto.codigo}</h2>
          <p className="ms-addr">{ponto.endereco ? `${ponto.endereco} · ${ponto.bairro}` : ponto.bairro}</p>
          <p className="ms-stat" style={{ color: nivel ? corNivel(nivel) : "var(--bone-300)" }}>{linhaSituacao(ponto, agora)}</p>
        </div>
        <button type="button" className="icon-btn ms-x" onClick={aoFechar} aria-label="Fechar">
          <IconeFechar pequeno />
        </button>
      </div>
      <dl className="ms-fatos">
        {fatos.map((fato) => (
          <div key={fato.id} className="ms-fato" aria-label={fato.descricao}>
            <dt>{fato.rotulo}</dt>
            <dd className={fato.valor === "—" ? "ms-vazio" : undefined}>{fato.valor}</dd>
          </div>
        ))}
      </dl>
      <div className="ms-acoes">
        <button type="button" className="btn btn-bone ms-acao" onClick={() => aoVerBueiro(ponto.id)}>Ver detalhes</button>
        <button type="button" className="btn btn-iron ms-acao ms-acao-2" onClick={aoVerRotas}><IconeRota pequeno />Desviar</button>
      </div>
    </section>
  );
}
