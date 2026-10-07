// Tela principal: o mapa de risco. Fica sempre montada; as outras telas abrem por cima dela.
//
// O que tem aqui: botão de menu, o botão "onde estou", avisos sobre a origem dos dados, o aviso
// por região (quando alguma está em atenção ou risco alto), a barra de busca em vidro (bueiros e
// lugares para ir) e o cartão que sobe quando um bueiro é tocado. As ruas em volta dos bueiros em
// nível alto ou crítico são pintadas pelo próprio mapa (src/mapa/ruasAfetadas.js).
// No endereço /rota o mapa entra no "modo rota": desenha o caminho e troca a barra de busca pelo
// cartão da rota. O destino vem da busca (src/telas/Busca.jsx); a partida e as trocas, de
// src/telas/Rotas.jsx.
// O ponto selecionado fica no endereço (/?ponto=ID), então dá para abrir o app direto num bueiro
// por um link. Tocar em outro ponto troca o endereço sem empilhar histórico.
// No endereço /viagem (botão "Começar viagem" do cartão da rota) o mapa vira a tela de navegação:
// os controles saem e entra src/telas/Viagem.jsx, com a próxima manobra e o carro no caminho.
// Com o modo vitrine ligado no Menu, o mapa passeia sozinho quando ninguém mexe (useVitrine.js).

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate, useSearchParams } from "react-router";
import { MapaBase } from "../mapa/MapaBase";
import { usePontos } from "../dados/PontosContexto";
import { usePreferencias } from "../preferencias/PreferenciasContexto";
import { useRotas } from "../rotas/RotaContexto";
import { REGRAS, resumoDaRota, textoDistancia, textoDuracao, viasPrincipais } from "../rotas/planejar";
import { corNivel } from "../dados/niveis";
import { fatosDoCartao, horaCurta, linhaSituacao, nivelVisivel } from "../dados/modelo";
import { avisosPorRegiao, resumoDosAvisos } from "../dados/regioes";
import { useApresentacao } from "../componentes/PrimeiroUso";
import { useTelaLarga } from "../componentes/ganchos";
import { useArrastarVertical } from "../componentes/arrastar";
import { useEsc } from "../componentes/Tela";
import { useVitrine, vitrinePedidaNoEndereco } from "./useVitrine";
import { Viagem } from "./Viagem";
import {
  IconeBusca, IconeChuva, IconeChuvisco, IconeFechar, IconeLocalizar, IconeMenu, IconeNavegar, IconePessoa, IconeRota,
  IconeSeta, IconeSol, IconeTempestade,
} from "../componentes/Icones";

const ICONE_DO_CLIMA = { sol: IconeSol, chuvisco: IconeChuvisco, "chuva-forte": IconeChuva, "chuva-extrema": IconeTempestade };

export default function Mapa() {
  const { pontos, agora, fonte, erro, carregando, simulacao, atualizadoEm, atualizar, demo } = usePontos();
  const { tema, vitrine: vitrineLigada } = usePreferencias();
  const navegar = useNavigate();
  const local = useLocation();
  const [parametros] = useSearchParams();
  const rotaBueiro = useMatch("/bueiro/:id");
  const telaLarga = useTelaLarga();
  const mapaRef = useRef(null);
  const topoRef = useRef(null);
  const cartaoRef = useRef(null);
  const barraRef = useRef(null);
  const painelRef = useRef(null);
  const rotas = useRotas();
  const apresentacao = useApresentacao();

  const [recado, setRecado] = useState(null);
  // Aviso por região: o que os bueiros de cada subprefeitura dizem em conjunto (src/dados/regioes.js).
  const avisoRegional = useMemo(() => resumoDosAvisos(avisosPorRegiao(pontos, agora)), [pontos, agora]);

  const naRaiz = local.pathname === "/";
  const emRota = local.pathname === "/rota";
  const emViagem = local.pathname === "/viagem";
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

  // No modo rota, tocar num bueiro abre a tela dele (voltar devolve à rota); no mapa comum, o cartão.
  // Durante a viagem o toque não faz nada: abrir outra tela encerraria a navegação.
  const selecionar = (id) => {
    if (emViagem) return;
    if (emRota) navegar(`/bueiro/${encodeURIComponent(id)}`);
    else navegar({ pathname: "/", search: `?ponto=${encodeURIComponent(id)}` }, { replace: naRaiz });
  };
  const fecharCartao = () => {
    if (cartaoAberto) navegar("/", { replace: true });
  };

  useEsc(fecharCartao, cartaoAberto); // Esc fecha o cartão

  // Modo rota: avisa o estado das rotas (que só calcula com o mapa neste modo) e, se a pessoa
  // chegou aqui sem partida e destino (recarregou a página, por exemplo), manda escolher.
  const { definirAtiva } = rotas;
  const semViagem = !rotas.origem || !rotas.destino;
  useEffect(() => {
    definirAtiva(emRota);
    if (emRota && semViagem) navegar("/rotas", { replace: true });
  }, [emRota, semViagem, definirAtiva, navegar]);
  const sairDaRota = () => navegar("/", { replace: true });
  useEsc(sairDaRota, emRota);

  // Viagem: começa pelo cartão da rota, com a rota que está em destaque. Quem chega a /viagem sem
  // viagem começada (recarregou a página, por exemplo) volta ao cartão da rota.
  const { viagem, iniciarViagem, encerrarViagem } = rotas;
  const [seguindo, setSeguindo] = useState(true);
  const comecarViagem = (rota) => iniciarViagem(rota, rotas.destino);
  // A tela de viagem abre depois de a viagem estar guardada: assim /viagem nunca fica sem ela.
  const partidaAberta = useRef(0);
  const estavaEmViagem = useRef(false);
  useEffect(() => {
    if (viagem && viagem.partida !== partidaAberta.current) {
      partidaAberta.current = viagem.partida;
      navegar("/viagem");
      return;
    }
    if (emViagem && !viagem) navegar("/rota", { replace: true });
    // Saiu da tela de viagem por qualquer caminho (botão, Esc, voltar do navegador): a viagem acaba.
    if (estavaEmViagem.current && !emViagem && viagem) encerrarViagem();
    estavaEmViagem.current = emViagem;
  }, [emViagem, viagem, encerrarViagem, navegar]);
  const sairDaViagem = () => navegar("/rota", { replace: true });
  const concluirViagem = () => navegar("/", { replace: true });
  useEsc(sairDaViagem, emViagem);

  // O que o mapa desenha no modo rota: o caminho escolhido em destaque e a outra opção em cinza.
  // Na viagem, só o caminho que está sendo seguido, sem mexer na câmera (ela segue o carro).
  const { resultado, escolhida, origem: partida, destino: chegada } = rotas;
  const rotaNoMapa = useMemo(() => {
    if (emViagem && viagem) {
      const caminho = viagem.rota.caminho;
      return { ativa: caminho, outra: null, origem: caminho[0], destino: [viagem.destino.lon, viagem.destino.lat], enquadrar: false };
    }
    if (!emRota || !resultado || !partida || !chegada) return null;
    const ativa = resumoDaRota(resultado, escolhida).rota;
    const outra = resultado.segura && resultado.segura !== resultado.rapida ? (ativa === resultado.segura ? resultado.rapida : resultado.segura) : null;
    return { ativa: ativa.caminho, outra: outra?.caminho ?? null, origem: [partida.lon, partida.lat], destino: [chegada.lon, chegada.lat] };
  }, [emRota, emViagem, viagem, resultado, escolhida, partida, chegada]);

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
    if (!climas || !(naRaiz || emRota || emViagem)) return undefined;
    const aoApertar = (evento) => {
      const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test(evento.target?.tagName ?? "");
      if (digitando || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      const escolhido = climas[Number(evento.key) - 1];
      if (escolhido) definirClima(escolhido.id);
    };
    document.addEventListener("keydown", aoApertar);
    return () => document.removeEventListener("keydown", aoApertar);
  }, [climas, definirClima, naRaiz, emRota, emViagem]);

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

  // Modo vitrine: só na demonstração (é ela que tem o clima para trocar). Liga pelo Menu ou, só
  // para aquela visita, por ?vitrine=1 no endereço (é como a página do projeto mostra o app).
  const [vitrinePedida] = useState(vitrinePedidaNoEndereco);
  const vitrine = useVitrine({ ligada: (vitrineLigada || vitrinePedida) && Boolean(demo), comecarLogo: vitrinePedida,
    bloqueada: apresentacao.aberta || emViagem, mapaRef, pontos, agora, demo, navegar });

  // "Usar minha localização", no último passo da apresentação de primeiro uso.
  const pedido = apresentacao.pedidoDeLocalizacao;
  useEffect(() => {
    if (pedido > 0) localizar();
    // Só quando o pedido muda; `localizar` é recriada a cada desenho.
  }, [pedido]);

  // No celular, com outra tela por cima, o mapa sai do alcance do teclado e do leitor de tela.
  // O mesmo vale enquanto a apresentação de primeiro uso está aberta.
  const coberto = (!naRaiz && !emRota && !emViagem && !telaLarga) || apresentacao.aberta;

  return (
    <section className="mp" aria-label="Mapa de risco" inert={coberto}>
      <MapaBase
        ref={mapaRef}
        pontos={pontos}
        agora={agora}
        tema={tema}
        selecionadoId={selecionado?.id ?? null}
        rota={rotaNoMapa}
        aoTocarPonto={selecionar}
        aoTocarFundo={fecharCartao}
        aoMexerNoMapa={() => { if (emViagem) setSeguindo(false); }}
        medirAreaLivre={() => ({
          topo: topoRef.current?.getBoundingClientRect().bottom ?? 110,
          cartao: ((emRota ? painelRef.current : cartaoRef.current)?.offsetHeight ?? 0) + 16,
          coluna: 420,
        })}
      />

      {emViagem && viagem ? (
        <Viagem mapaRef={mapaRef} seguindo={seguindo} aoSeguir={setSeguindo} aoSair={sairDaViagem} aoConcluir={concluirViagem}
          clima={demo ? <SeletorDeClima demo={demo} /> : null} />
      ) : null}

      <div className="mp-top" ref={topoRef} hidden={emViagem}>
        <div className="mp-esq">
          <div className="mp-linha">
            <button type="button" className="lg lg-round" onClick={() => navegar("/menu")} aria-label="Abrir menu e configurações">
              <IconeMenu />
            </button>
            {demo ? <SeletorDeClima demo={demo} /> : null}
          </div>
          <Avisos fonte={fonte} erro={erro} carregando={carregando} simulacao={simulacao} atualizadoEm={atualizadoEm}
            temPontos={pontos.length > 0} aoTentarDeNovo={atualizar} demo={demo} />
          {avisoRegional ? (
            <button type="button" className={`lg mp-aviso mp-regiao mp-regiao-${avisoRegional.nivel}`} onClick={() => navegar("/alertas")} aria-label={avisoRegional.descricao}>
              <span className="mp-aviso-dot" aria-hidden="true" />
              <span className="mp-regiao-texto">{avisoRegional.texto}</span>
              <IconeSeta pequeno />
            </button>
          ) : null}
          {recado ? <p className="lg mp-aviso" role="status">{recado}</p> : null}
          {vitrine.rodando ? (
            <p className="lg mp-aviso mp-vitrine" role="status"><span className="mp-aviso-dot" aria-hidden="true" />Modo vitrine · toque para usar o app</p>
          ) : null}
        </div>

        <button type="button" className="lg lg-round" onClick={localizar} aria-label="Centralizar em mim">
          <IconeLocalizar />
        </button>
      </div>

      <div ref={barraRef} className={`lg mbar ${cartaoAberto || emRota || emViagem ? "mbar-oculta" : ""}`} inert={cartaoAberto || emRota || emViagem}>
        <span className="grabber" aria-hidden="true" />
        <button type="button" className="mbar-field" onClick={() => navegar("/busca")} aria-label="Buscar um lugar para ir, um bueiro ou um bairro">
          <IconeBusca />
          <span className="mbar-ph">Buscar lugar ou bueiro</span>
        </button>
        <button type="button" className="mbar-av" onClick={() => navegar("/perfil")} aria-label="Perfil">
          <IconePessoa />
        </button>
      </div>

      <CartaoBueiro refCartao={cartaoRef} ponto={ultimo.current} aberto={cartaoAberto} agora={agora} aoFechar={fecharCartao}
        aoVerBueiro={(id) => navegar(`/bueiro/${encodeURIComponent(id)}`)} aoVerRotas={() => navegar("/rotas")} />

      {emRota && !semViagem ? (
        <PainelRota refPainel={painelRef} rotas={rotas} aoFechar={sairDaRota} aoTrocar={() => navegar("/rotas")} aoComecar={comecarViagem} />
      ) : null}
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
 * Na faixa, a água é MEDIDA pelo sensor; a chance de alagar é PREVISTA pela IA.
 * O botão azul é a ação principal e depende do bueiro: num ponto em risco (alto, crítico ou
 * transbordando) é "Desviar", que leva às rotas; nos demais é "Ver detalhes".
 */
function CartaoBueiro({ refCartao, ponto, aberto, agora, aoFechar, aoVerBueiro, aoVerRotas }) {
  if (!ponto) return null;
  const nivel = nivelVisivel(ponto, agora);
  const fatos = fatosDoCartao(ponto, agora);
  const emRisco = ponto.medicaoTransbordando || (nivel ?? 0) >= REGRAS.nivelMinimo;

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
        <button type="button" className={`btn ms-acao ${emRisco ? "btn-iron ms-acao-neutra" : "btn-bone"}`} onClick={() => aoVerBueiro(ponto.id)}>Ver detalhes</button>
        <button type="button" className={`btn ms-acao ${emRisco ? "btn-bone" : "btn-iron ms-acao-2 ms-acao-neutra"}`} onClick={aoVerRotas}>
          <IconeRota pequeno />{emRisco ? "Desviar" : "Rotas"}
        </button>
      </div>
    </section>
  );
}

const COR_DO_TOM = { 1: "var(--r1)", 3: "var(--r3)", 4: "var(--r4)" };

/**
 * Cartão do modo rota: tempo e distância, se a rota é segura, quanto ela custa a mais que o
 * caminho mais rápido e, quando há duas opções, a troca entre elas. O caminho fica no mapa.
 * "Começar viagem" abre a navegação passo a passo (src/telas/Viagem.jsx) pela rota em destaque.
 */
function PainelRota({ refPainel, rotas, aoFechar, aoTrocar, aoComecar }) {
  const { origem, destino, fase, resultado, erro, atualizando, escolhida, escolher, tentarDeNovo } = rotas;
  const resumo = resultado ? resumoDaRota(resultado, escolhida) : null;
  const vias = resumo ? viasPrincipais(resumo.rota.trechos) : [];
  const duasOpcoes = resultado?.situacao === "desvia" || resultado?.situacao === "parcial";

  return (
    <section ref={refPainel} className="lg lg-strong ms rt-painel" aria-label="Rota">
      <div className="ms-head rt-head">
        <div style={{ minWidth: 0 }} aria-live="polite">
          {resumo ? (
            <>
              <h2 className="ms-title">{textoDuracao(resumo.rota.minutos)}<span className="rt-km"> · {textoDistancia(resumo.rota.km)}</span></h2>
              <p className="ms-stat" style={{ color: COR_DO_TOM[resumo.tom] }}>{resumo.titulo}</p>
              <p className="rt-frase">{resumo.situacao}. {resumo.comparacao}</p>
              {vias.length ? <p className="rt-vias rt-por">por {vias.join(" e ")}</p> : null}
              {atualizando ? <p className="rt-vias" role="status">Atualizando a rota com a nova situação dos bueiros…</p> : null}
              {erro ? <p className="rt-vias" role="alert">{erro}</p> : null}
            </>
          ) : fase === "erro" ? (
            <>
              <h2 className="ms-title">Rota não traçada</h2>
              <p className="rt-frase" role="alert">{erro}</p>
            </>
          ) : (
            <>
              <h2 className="ms-title">Traçando a rota…</h2>
              <p className="rt-frase">Procurando o caminho que desvia dos bueiros em risco.</p>
            </>
          )}
        </div>
        <button type="button" className="icon-btn ms-x" onClick={aoFechar} aria-label="Fechar a rota">
          <IconeFechar pequeno />
        </button>
      </div>

      {duasOpcoes ? (
        <div className="seg rt-opcoes" role="group" aria-label="Qual caminho mostrar">
          <button type="button" className={escolhida === "segura" ? "seg-on" : undefined} aria-pressed={escolhida === "segura"} onClick={() => escolher("segura")}>
            {resultado.situacao === "parcial" ? "Menos risco" : "Segura"} · {textoDuracao(resultado.segura.minutos)}
          </button>
          <button type="button" className={escolhida === "rapida" ? "seg-on" : undefined} aria-pressed={escolhida === "rapida"} onClick={() => escolher("rapida")}>
            Mais rápida · {textoDuracao(resultado.rapida.minutos)}
          </button>
        </div>
      ) : null}

      <div className="ms-acoes rt-acoes-rota">
        {fase === "erro" ? <button type="button" className="btn btn-bone ms-acao" onClick={tentarDeNovo}>Tentar de novo</button> : null}
        <button type="button" className="btn btn-iron ms-acao rt-viagem" onClick={aoTrocar} aria-label={`De ${origem.nome} para ${destino.nome}. Trocar partida ou destino`}>
          <span className="rt-viagem-texto">{origem.nome} → {destino.nome}</span>
          <span className="rt-viagem-acao">Trocar</span>
        </button>
        {/* A viagem segue a rota que está em destaque (a segura ou a mais rápida, conforme a escolha). */}
        {resumo ? (
          <button type="button" className="btn btn-bone ms-acao rt-comecar" onClick={() => aoComecar(resumo.rota)}>
            <IconeNavegar pequeno />Começar viagem
          </button>
        ) : null}
      </div>
    </section>
  );
}
