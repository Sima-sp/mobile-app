// Tela de viagem: a navegação passo a passo, como nos apps de trânsito. Abre no endereço /viagem,
// pelo botão "Começar viagem" do cartão da rota, e fica por cima do mapa (que continua sendo o
// mesmo de src/telas/Mapa.jsx).
//
// O que aparece:
// - no alto, a próxima manobra: a seta, a distância até ela e a rua em que se entra;
// - embaixo, quanto falta (tempo, distância, hora de chegada) e o botão de sair;
// - no mapa, o carro sobre o caminho, com a câmera atrás dele.
//
// A VIAGEM É SIMULADA: o carro anda sozinho pelo caminho, na velocidade média que o serviço de
// rotas calculou, multiplicada pela velocidade escolhida (1×, 5× ou 15×). O app ainda não segue o
// GPS do aparelho. Isso está escrito na tela ("Viagem simulada").
//
// O que é do SIMA: se, no meio da viagem, um bueiro do caminho que falta entra em risco (na
// demonstração, ao trocar o clima), a tela avisa, para o carro um instante e pede um caminho novo
// a partir de onde ele está, desviando desse bueiro. Se não houver desvio, o aviso continua na tela.
//
// As contas (onde o carro está, qual é a próxima manobra, quanto falta) ficam em
// src/rotas/viagem.js, que é testado sem tela.

import { useEffect, useMemo, useRef, useState } from "react";
import { usePontos } from "../dados/PontosContexto";
import { nivelVisivel } from "../dados/modelo";
import { useRotas } from "../rotas/RotaContexto";
import { assinaturaDoRisco, noCaminho, planejarRota, pontosEmRisco, textoDistancia, textoDuracao } from "../rotas/planejar";
import { pedirRotaDeCarro } from "../rotas/servico";
import {
  caminhoQueFalta, descreverManobra, giro, horaDeChegada, pontoNoMetro, prepararViagem, rumoNoMetro, situacaoDaViagem, textoAteManobra,
} from "../rotas/viagem";
import { IconeLocalizar, IconeManobra } from "../componentes/Icones";

/** Velocidades da simulação e a que distância a câmera fica em cada uma (mais rápido, mais longe). */
const VELOCIDADES = [
  { fator: 1, rotulo: "1×", nome: "velocidade real", zoom: 17 },
  { fator: 5, rotulo: "5×", nome: "5 vezes mais rápido", zoom: 16.3 },
  { fator: 15, rotulo: "15×", nome: "15 vezes mais rápido", zoom: 15.5 },
];
const VELOCIDADE_INICIAL = 1;
/** Inclinação da câmera atrás do carro, em graus. Com "menos movimento", o mapa fica de cima. */
const INCLINACAO = 55;
/** Tempo para a câmera chegar atrás do carro antes de ele sair, em milissegundos. */
const LARGADA_MS = 1000;
/** De quantos em quantos metros a tela confere se há bueiro em risco no caminho que falta. */
const CONFERIR_A_CADA = 150;
/** Quanto tempo o recado de "nova rota" fica na tela. */
const RECADO_MS = 8000;

const menosMovimento = () => document.documentElement.classList.contains("mov-reduzido");
const telaLarga = () => window.matchMedia("(min-width: 900px)").matches;

/** Onde o carro aparece na tela: abaixo do meio, entre a faixa da manobra e o painel de baixo. */
function margemDaCamera() {
  const altura = window.innerHeight;
  return telaLarga()
    ? { top: Math.round(altura * 0.3), bottom: 40, left: 420, right: 0 }
    : { top: Math.round(altura * 0.36), bottom: 150, left: 0, right: 0 };
}

/** O que a tela mostra num instante da viagem. Só muda quando algum texto muda. */
function montarQuadro(viagem, situacao, relogio) {
  return {
    ate: textoAteManobra(situacao.ateProxima),
    proxima: descreverManobra(situacao.proxima),
    seguinte: situacao.seguinte ? descreverManobra(situacao.seguinte) : null,
    duracao: textoDuracao(situacao.restanteSegundos / 60),
    distancia: textoDistancia(situacao.restanteMetros / 1000),
    chegada: horaDeChegada(relogio, situacao.restanteSegundos),
    chegou: situacao.chegou,
    // Muda a cada trecho percorrido: é o que faz a tela conferir de novo o risco à frente.
    balde: Math.floor((viagem.metros - situacao.restanteMetros) / CONFERIR_A_CADA),
  };
}
const chaveDoQuadro = (q) => [q.ate, q.proxima.frase, q.proxima.rua, q.seguinte?.frase, q.duracao, q.distancia, q.chegada, q.chegou, q.balde].join("|");

/**
 * @param {object} props
 * @param {object} props.mapaRef        comandos do mapa (src/mapa/MapaBase.jsx)
 * @param {boolean} props.seguindo      a câmera está acompanhando o carro?
 * @param {Function} props.aoSeguir     (sim: boolean) => void
 * @param {Function} props.aoSair       sair da viagem antes de chegar (volta ao cartão da rota)
 * @param {Function} props.aoConcluir   fechar a viagem depois de chegar (volta ao mapa)
 * @param {React.ReactNode} [props.clima]  o controle do clima da demonstração, quando existe
 */
export function Viagem({ mapaRef, seguindo, aoSeguir, aoSair, aoConcluir, clima = null }) {
  const { pontos, agora, demo } = usePontos();
  const { viagem: emCurso, trocarRotaDaViagem } = useRotas();
  const { rota, destino, partida } = emCurso;
  const viagem = useMemo(() => prepararViagem(rota), [rota]);

  const [indiceVelocidade, setIndiceVelocidade] = useState(VELOCIDADE_INICIAL);
  const [recalculando, setRecalculando] = useState(false);
  const [recado, setRecado] = useState(null);

  // O andamento fica fora do estado do React: muda a cada quadro, e a tela só é redesenhada
  // quando algum texto muda (ver chaveDoQuadro).
  const andamento = useRef(null);
  if (!andamento.current) {
    andamento.current = { metro: 0, simulados: 0, inicio: Date.now(), rumoDaCamera: 0, parado: false, largada: 0, cameraLivreEm: 0,
      partida: null, viagem: null, chave: "" };
  }
  const [quadro, setQuadro] = useState(() => montarQuadro(viagem, situacaoDaViagem(viagem, 0), new Date()));

  // O laço lê sempre os valores mais recentes, sem recomeçar a cada desenho da tela.
  const atual = useRef(null);
  atual.current = { seguindo, velocidade: VELOCIDADES[indiceVelocidade], pontos, agora };

  /** Como a câmera deve ficar atrás do carro num ponto da viagem. */
  const enquadramento = (metro) => {
    const [lon, lat] = pontoNoMetro(viagem, metro);
    return { lon, lat, rumo: rumoNoMetro(viagem, metro), zoom: atual.current.velocidade.zoom,
      inclinacao: menosMovimento() ? 0 : INCLINACAO, margem: margemDaCamera() };
  };

  // Entra na viagem (o carro aparece e a câmera vai para trás dele) e, ao fechar a tela, sai
  // dela (mapa de volta ao normal). Vem antes do laço: o carro precisa existir para andar.
  useEffect(() => {
    const mapa = mapaRef.current;
    mapa?.entrarNaViagem(enquadramento(andamento.current.partida === partida ? andamento.current.metro : 0));
    aoSeguir(true);
    return () => mapa?.sairDaViagem();
    // Uma vez por viagem começada; `enquadramento` e `aoSeguir` são recriados a cada desenho.
  }, [partida, mapaRef]);

  // O laço da viagem: a cada quadro, anda o carro, move a câmera e atualiza os textos.
  useEffect(() => {
    const a = andamento.current;
    const agoraMs = performance.now();
    if (a.partida !== partida) {
      // Viagem nova: o carro espera a câmera chegar atrás dele.
      Object.assign(a, { partida, viagem, metro: 0, simulados: 0, inicio: Date.now(), largada: agoraMs + LARGADA_MS, cameraLivreEm: agoraMs + LARGADA_MS });
      a.rumoDaCamera = rumoNoMetro(viagem, 0);
    } else if (a.viagem !== viagem) {
      // Caminho novo no meio da viagem: ele começa onde o carro está.
      Object.assign(a, { viagem, metro: 0 });
    }
    const metrosPorSegundo = viagem.segundos > 0 ? viagem.metros / viagem.segundos : 8;

    let quadroPedido = 0;
    let anterior = agoraMs;
    const passo = (instante) => {
      // Um quadro que demora mais de 1 s é a aba voltando do segundo plano: não conta como viagem.
      const dt = Math.min(1, Math.max(0, (instante - anterior) / 1000));
      anterior = instante;
      const { velocidade, seguindo: seguir } = atual.current;
      if (!a.parado && instante >= a.largada) {
        a.metro = Math.min(viagem.metros, a.metro + dt * velocidade.fator * metrosPorSegundo);
        a.simulados += dt * velocidade.fator;
      }
      const situacao = situacaoDaViagem(viagem, a.metro);
      const inclinado = !menosMovimento();
      // A câmera gira aos poucos até o rumo do carro; sem isso cada esquina seria um tranco.
      a.rumoDaCamera = inclinado ? (a.rumoDaCamera + giro(a.rumoDaCamera, situacao.rumo) * (1 - Math.exp(-dt / 0.45)) + 360) % 360 : 0;
      mapaRef.current?.moverCarro({ lon: situacao.ponto[0], lat: situacao.ponto[1], rumo: situacao.rumo, rumoDaCamera: a.rumoDaCamera,
        seguir: seguir && instante >= a.cameraLivreEm });

      const novo = montarQuadro(viagem, situacao, new Date(a.inicio + a.simulados * 1000));
      const chave = chaveDoQuadro(novo);
      if (chave !== a.chave) {
        a.chave = chave;
        setQuadro(novo);
      }
      if (!situacao.chegou) quadroPedido = requestAnimationFrame(passo);
    };
    quadroPedido = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadroPedido);
    // O laço só recomeça quando a viagem (ou o caminho dela) muda.
  }, [viagem, partida, mapaRef]);

  /** Leva a câmera de volta para trás do carro (depois de arrastar o mapa ou de trocar a velocidade). */
  const retomar = () => {
    const a = andamento.current;
    a.cameraLivreEm = performance.now() + 520;
    a.rumoDaCamera = rumoNoMetro(viagem, a.metro);
    mapaRef.current?.retomarCarro(enquadramento(a.metro));
    aoSeguir(true);
  };
  const primeiraVelocidade = useRef(true);
  useEffect(() => {
    if (primeiraVelocidade.current) primeiraVelocidade.current = false;
    else if (atual.current.seguindo) retomar();
    // Só quando a velocidade muda.
  }, [indiceVelocidade]);

  // A tela não apaga durante a viagem (nos aparelhos que deixam).
  useEffect(() => {
    if (!navigator.wakeLock || quadro.chegou) return undefined;
    let trava = null;
    let vivo = true;
    const pedir = async () => {
      try {
        const nova = await navigator.wakeLock.request("screen");
        if (vivo) trava = nova;
        else nova.release();
      } catch {
        // Bateria fraca ou aba em segundo plano: a viagem segue, só a tela pode apagar.
      }
    };
    const aoVoltar = () => { if (document.visibilityState === "visible") pedir(); };
    pedir();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      vivo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      trava?.release().catch(() => {});
    };
  }, [quadro.chegou]);

  /* ───────────── Bueiro em risco à frente ───────────── */

  const assinatura = useMemo(() => assinaturaDoRisco(pontos, agora), [pontos, agora]);
  const aFrente = useMemo(() => {
    if (quadro.chegou) return [];
    return noCaminho(caminhoQueFalta(viagem, andamento.current.metro), pontosEmRisco(atual.current.pontos, atual.current.agora));
    // Confere de novo quando a lista de bueiros em risco muda ou a cada trecho percorrido.
  }, [viagem, assinatura, quadro.balde, quadro.chegou]);
  const temRiscoAFrente = aFrente.length > 0;
  const climaMudando = Boolean(demo?.mudando);

  // O risco que já existia ao começar não refaz a rota: a pessoa escolheu aquele caminho sabendo.
  // Só uma MUDANÇA nos bueiros em risco, com algum deles à frente, pede um caminho novo.
  const tratada = useRef({ partida: null, assinatura: null });
  if (tratada.current.partida !== partida) tratada.current = { partida, assinatura };

  useEffect(() => {
    // Durante a troca do clima a lista muda várias vezes: espera a cidade assentar.
    if (!temRiscoAFrente || climaMudando || tratada.current.assinatura === assinatura) return undefined;
    const a = andamento.current;
    const controle = new AbortController();
    const origem = pontoNoMetro(viagem, a.metro);
    const chegada = [destino.lon, destino.lat];
    const antes = aFrente.length;
    a.parado = true;
    setRecalculando(true);
    setRecado(null);
    planejarRota({ origem, destino: chegada, pontos: atual.current.pontos, agora: atual.current.agora,
      pedirRota: (areas) => pedirRotaDeCarro({ origem, destino: chegada, areas, sinal: controle.signal }) })
      .then((resultado) => {
        if (controle.signal.aborted) return;
        const nova = resultado.segura;
        if (nova && nova.emRisco.length < antes) {
          trocarRotaDaViagem(nova);
          const evitados = antes - nova.emRisco.length;
          setRecado(`Nova rota: desvia de ${evitados === 1 ? "1 bueiro em risco" : `${evitados} bueiros em risco`}`);
        }
      })
      .catch((erro) => {
        if (!controle.signal.aborted) console.warn("[SIMA] Não foi possível refazer a rota da viagem.", erro);
      })
      .finally(() => {
        if (controle.signal.aborted) return;
        // Achando ou não um desvio, esta situação dos bueiros está resolvida: não pede de novo.
        tratada.current.assinatura = assinatura;
        a.parado = false;
        setRecalculando(false);
      });
    return () => {
      controle.abort();
      a.parado = false;
      setRecalculando(false);
    };
    // `aFrente`, `destino` e `viagem` são lidos no momento do pedido; o que dispara é o risco mudar.
  }, [assinatura, temRiscoAFrente, climaMudando]);

  useEffect(() => {
    if (!recado) return undefined;
    const relogio = setTimeout(() => setRecado(null), RECADO_MS);
    return () => clearTimeout(relogio);
  }, [recado]);

  /* ───────────── Desenho ───────────── */

  const { proxima, seguinte } = quadro;
  const ruaDaManobra = proxima.seta === "chegada" ? destino.nome : proxima.rua;
  const maisGrave = aFrente.some((p) => p.medicaoTransbordando || (nivelVisivel(p, agora) ?? 0) >= 4) ? 4 : 3;
  const textoDoRisco = aFrente.length === 1 ? `Bueiro ${aFrente[0].codigo} em risco à frente` : `${aFrente.length} bueiros em risco à frente`;

  return (
    <>
      <div className="vg-top">
        {/* O leitor de tela ouve a manobra quando ela muda, e não a cada metro que passa. */}
        <p className="so-leitor" aria-live="polite">
          {quadro.chegou ? `Você chegou: ${destino.nome}` : `${proxima.frase}${ruaDaManobra ? `, ${ruaDaManobra}` : ""}`}
        </p>
        <section className="vg-faixa" aria-label="Próxima manobra">
          {quadro.chegou ? (
            <div className="vg-manobra">
              <span className="vg-seta" aria-hidden="true"><IconeManobra seta="chegada" /></span>
              <div className="vg-texto">
                <p className="vg-ate">Você chegou</p>
                <p className="vg-rua">{destino.nome}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="vg-manobra">
                <span className="vg-seta" aria-hidden="true"><IconeManobra seta={proxima.seta} /></span>
                <div className="vg-texto">
                  <p className="vg-ate">{quadro.ate === "agora" ? proxima.frase : `${quadro.ate}`}</p>
                  {quadro.ate === "agora" ? null : <p className="vg-frase">{proxima.frase}</p>}
                  {ruaDaManobra ? <p className="vg-rua">{ruaDaManobra}</p> : null}
                </div>
              </div>
              {seguinte ? (
                <p className="vg-depois">
                  <span>Depois</span>
                  <IconeManobra seta={seguinte.seta} pequeno />
                  <span className="vg-depois-texto">{seguinte.seta === "chegada" ? `chegada em ${destino.nome}` : (seguinte.rua || seguinte.frase)}</span>
                </p>
              ) : null}
            </>
          )}
        </section>

        <div className="vg-avisos">
          {clima}
          {recalculando ? (
            <p className="lg mp-aviso" role="status"><span className="mp-aviso-dot" aria-hidden="true" />Procurando um caminho que desvie…</p>
          ) : null}
          {temRiscoAFrente ? (
            <p className={`lg mp-aviso vg-risco vg-risco-${maisGrave}`} role="alert"><span className="mp-aviso-dot" aria-hidden="true" />{textoDoRisco}</p>
          ) : null}
          {recado && !recalculando ? <p className="lg mp-aviso" role="status"><span className="mp-aviso-dot" aria-hidden="true" />{recado}</p> : null}
        </div>
      </div>

      {seguindo || quadro.chegou ? null : (
        <button type="button" className="lg vg-centralizar" onClick={retomar}>
          <IconeLocalizar pequeno />Centralizar
        </button>
      )}

      <section className="lg lg-strong ms vg-painel" aria-label="Viagem">
        {quadro.chegou ? (
          // A faixa do alto já diz "Você chegou" e o nome do lugar: aqui fica só o botão.
          <div className="ms-acoes vg-fim">
            <button type="button" className="btn btn-bone ms-acao" onClick={aoConcluir}>Concluir</button>
          </div>
        ) : (
          <>
            <div className="vg-resumo">
              <div style={{ minWidth: 0 }} aria-live="off">
                <h2 className="ms-title">{quadro.duracao}</h2>
                <p className="vg-sub">{quadro.distancia} · chegada às {quadro.chegada}</p>
              </div>
              <button type="button" className="btn vg-sair" onClick={aoSair}>Sair</button>
            </div>
            <div className="vg-simulacao">
              <p className="vg-nota">Viagem simulada</p>
              <div className="seg" role="group" aria-label="Velocidade da simulação">
                {VELOCIDADES.map((v, i) => (
                  <button key={v.rotulo} type="button" className={i === indiceVelocidade ? "seg-on" : undefined} aria-pressed={i === indiceVelocidade}
                    aria-label={v.nome} onClick={() => setIndiceVelocidade(i)}>{v.rotulo}</button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
