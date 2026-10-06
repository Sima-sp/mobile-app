// Tela de rotas: partida e destino. O caminho em si aparece no mapa (modo rota, em
// src/telas/Mapa.jsx), com o cartão que compara a rota segura com a mais rápida.
//
// O caminho normal começa na busca do mapa (src/telas/Busca.jsx): a pessoa escolhe para onde vai
// e chega aqui só se a partida ainda não for conhecida. Aí a tela tenta a posição do aparelho
// ("Minha localização") e, enquanto isso ou se não der, oferece a escolha da partida.
// Também é aqui que se troca a partida ou o destino de uma rota aberta ("Trocar", no cartão).
// Cada campo aceita um endereço digitado (busca de endereço, src/rotas/servico.js) ou um dos
// lugares conhecidos (src/rotas/lugares.js), que funcionam mesmo se a busca estiver fora do ar.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useRotas } from "../rotas/RotaContexto";
import { LUGARES } from "../rotas/lugares";
import { useEnderecos } from "../rotas/useEnderecos";
import { semAcento } from "../dados/niveis";
import { BotaoVoltar, CabecalhoTela, Tela } from "../componentes/Tela";
import { IconeBusca, IconeFechar, IconeInverter, IconeLocalizar, IconePino, IconeSeta, IconeVoltar } from "../componentes/Icones";

const normalizar = (texto) => semAcento(texto).toLowerCase().trim();
const ROTULO = { origem: "De onde você sai?", destino: "Para onde você vai?" };

/**
 * Pede a posição do aparelho uma vez. Se a pessoa não responder ao pedido de permissão do
 * navegador, desiste depois de um tempo (o navegador, sozinho, esperaria para sempre).
 */
function obterPosicao() {
  return new Promise((resolver, rejeitar) => {
    if (!navigator.geolocation) {
      rejeitar(new Error("Este aparelho não informa a localização. Escolha o ponto de partida na lista."));
      return;
    }
    const semResposta = setTimeout(() => rejeitar(new Error("Não foi possível obter sua localização. Escolha o ponto de partida na lista.")), 15000);
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        clearTimeout(semResposta);
        resolver({ id: "eu", eu: true, nome: "Minha localização", detalhe: "", lon: posicao.coords.longitude, lat: posicao.coords.latitude });
      },
      (falha) => {
        clearTimeout(semResposta);
        rejeitar(new Error(falha.code === 1
          ? "Localização não permitida. Escolha o ponto de partida na lista."
          : "Não foi possível obter sua localização. Escolha o ponto de partida na lista."));
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

export default function Rotas() {
  const { origem, destino, definirOrigem, definirDestino, inverter } = useRotas();
  const navegar = useNavigate();
  // Qual campo está sendo escolhido agora (null = mostra o resumo com os dois).
  const [campo, setCampo] = useState(() => {
    if (!destino) return "destino";
    return origem ? null : "origem";
  });
  const [aviso, setAviso] = useState(null);
  const [localizando, setLocalizando] = useState(false);

  const verRota = () => navegar("/rota", { replace: true });

  // A posição do aparelho pode demorar (ou depender de a pessoa responder ao navegador). Enquanto
  // isso a tela continua usável; se a pessoa escolher a partida na lista, a resposta é ignorada.
  const pedidoDePosicao = useRef(0);
  useEffect(() => () => { pedidoDePosicao.current = -1; }, []);

  async function usarMinhaPosicao(destinoEscolhido = destino) {
    const meuPedido = ++pedidoDePosicao.current;
    setLocalizando(true);
    setAviso(null);
    try {
      const posicao = await obterPosicao();
      if (pedidoDePosicao.current !== meuPedido) return;
      definirOrigem(posicao);
      if (destinoEscolhido) verRota();
      else setCampo("destino");
    } catch (erro) {
      if (pedidoDePosicao.current !== meuPedido) return;
      setAviso(erro.message);
      setCampo("origem");
    } finally {
      if (pedidoDePosicao.current === meuPedido) setLocalizando(false);
    }
  }

  // Chegou com o destino escolhido (pela busca do mapa) e sem partida: tenta a posição do aparelho.
  const jaTentou = useRef(false);
  useEffect(() => {
    if (jaTentou.current || !destino || origem) return;
    jaTentou.current = true;
    usarMinhaPosicao(destino);
    // Só na abertura da tela; depois disso quem decide é a pessoa.
  }, []);

  function aoEscolher(lugar) {
    setAviso(null);
    if (campo === "origem") {
      pedidoDePosicao.current += 1; // a pessoa escolheu a partida: uma posição que chegar depois não vale
      setLocalizando(false);
      definirOrigem(lugar);
      if (destino) verRota();
      else setCampo("destino");
      return;
    }
    definirDestino(lugar);
    if (origem) {
      verRota();
      return;
    }
    // Sem partida ainda: mostra a escolha da partida e, ao mesmo tempo, tenta a posição do aparelho.
    setCampo("origem");
    usarMinhaPosicao(lugar);
  }

  if (campo) {
    return (
      <Tela titulo={ROTULO[campo]}>
        <EscolherLugar campo={campo} aviso={aviso} localizando={localizando} aoEscolher={aoEscolher} aoUsarPosicao={() => usarMinhaPosicao()}
          aoVoltar={origem || destino ? () => setCampo(null) : null} outroLugar={campo === "origem" ? destino : origem} />
      </Tela>
    );
  }

  return (
    <Tela titulo="Rotas">
      <CabecalhoTela titulo="Rotas" />
      <p className="sub rt-intro">O SIMA traça o caminho de carro desviando dos bueiros em nível alto ou crítico.</p>
      <div className="grp rt-campos">
        <button type="button" className="row row-2" onClick={() => setCampo("origem")}>
          <span className="rt-marca rt-marca-origem" aria-hidden="true" />
          <span className="row-k"><span className="row-sub rt-papel">De</span>{origem ? origem.nome : "Escolher a partida"}</span>
          <span className="row-chev"><IconeSeta pequeno /></span>
        </button>
        <button type="button" className="row row-2" onClick={() => setCampo("destino")}>
          <span className="rt-marca rt-marca-destino" aria-hidden="true" />
          <span className="row-k"><span className="row-sub rt-papel">Para</span>{destino ? destino.nome : "Escolher o destino"}</span>
          <span className="row-chev"><IconeSeta pequeno /></span>
        </button>
      </div>
      {aviso ? <p className="small rt-aviso" role="alert">{aviso}</p> : null}
      <div className="rt-acoes">
        <button type="button" className="btn btn-bone rt-tracar" disabled={!origem || !destino} onClick={verRota}>Traçar rota</button>
        <button type="button" className="btn btn-iron" disabled={!origem || !destino} onClick={inverter} aria-label="Inverter partida e destino">
          <IconeInverter pequeno />Inverter
        </button>
      </div>
      <p className="micro rt-nota">
        Rotas só de carro. O trajeto vem de um serviço aberto de rotas (Valhalla, com dados do OpenStreetMap); só a partida e o destino são enviados a ele.
      </p>
    </Tela>
  );
}

/** Escolha de um lugar: campo de busca, "Minha localização" (na partida), endereços achados e lugares conhecidos. */
function EscolherLugar({ campo, aviso, localizando, aoEscolher, aoUsarPosicao, aoVoltar, outroLugar }) {
  const [texto, setTexto] = useState("");
  const busca = useEnderecos(texto);
  const entrada = useRef(null);

  useEffect(() => {
    entrada.current?.focus({ preventScroll: true });
  }, [campo]);

  const termo = texto.trim();

  // O lugar já usado no outro campo não aparece: partida e destino iguais não fazem rota.
  const conhecidos = useMemo(() => {
    const alvo = normalizar(termo);
    return LUGARES.filter((l) => l.id !== outroLugar?.id && (!alvo || normalizar(`${l.nome} ${l.detalhe}`).includes(alvo)));
  }, [termo, outroLugar]);

  const linha = (lugar) => (
    <button key={lugar.id} type="button" className="row row-2" onClick={() => aoEscolher(lugar)}>
      <span className="row-ic" aria-hidden="true"><IconePino pequeno /></span>
      <span className="row-k">{lugar.nome}{lugar.detalhe ? <span className="row-sub">{lugar.detalhe}</span> : null}</span>
    </button>
  );

  return (
    <>
      <div className="bs-bar">
        {aoVoltar
          ? <button type="button" className="icon-btn" onClick={aoVoltar} aria-label="Voltar para a partida e o destino"><IconeVoltar /></button>
          : <BotaoVoltar rotulo="Voltar ao mapa" />}
        <div className="bs-in" role="search">
          <IconeBusca />
          <input ref={entrada} className="input" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder={ROTULO[campo]} aria-label={`${ROTULO[campo]} Endereço ou lugar`} enterKeyHint="search" autoComplete="off" />
          {texto ? (
            <button type="button" className="bs-clear" onClick={() => setTexto("")} aria-label="Limpar"><IconeFechar pequeno /></button>
          ) : null}
        </div>
      </div>

      {campo === "origem" && outroLugar ? <p className="small rt-contexto">Indo para <b>{outroLugar.nome}</b></p> : null}
      {aviso ? <p className="small rt-aviso" role="alert">{aviso}</p> : null}

      {campo === "origem" ? (
        <div className="grp rt-eu">
          <button type="button" className="row row-2" onClick={aoUsarPosicao} disabled={localizando}>
            <span className="row-ic rt-ic-eu" aria-hidden="true"><IconeLocalizar pequeno /></span>
            <span className="row-k">{localizando ? "Procurando sua posição…" : "Minha localização"}</span>
          </button>
        </div>
      ) : null}

      <div aria-live="polite">
        {busca.fase === "procurando" && busca.lugares.length === 0 ? <p className="small bs-vazio">Procurando endereços…</p> : null}
        {busca.fase === "erro" ? <p className="small bs-vazio">A busca de endereço não respondeu. Dá para escolher um dos lugares abaixo.</p> : null}
        {busca.fase === "pronta" && busca.lugares.length === 0 && conhecidos.length === 0
          ? <p className="small bs-vazio">Nenhum endereço encontrado para “{termo}”. Tente o nome da rua com o bairro.</p> : null}
        {busca.lugares.length ? (
          <>
            <h2 className="grp-t">Endereços</h2>
            <div className="grp">{busca.lugares.map(linha)}</div>
          </>
        ) : null}
      </div>

      {conhecidos.length ? (
        <>
          <h2 className="grp-t">Lugares conhecidos</h2>
          <div className="grp">{conhecidos.map(linha)}</div>
        </>
      ) : null}
    </>
  );
}
