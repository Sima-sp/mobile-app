// Tela de busca, aberta pela barra de baixo do mapa. Um campo só para as duas coisas que a pessoa
// procura:
// - um LUGAR PARA IR (endereço digitado ou lugar conhecido): tocar nele traça a rota de carro até
//   lá, desviando dos bueiros em risco;
// - um BUEIRO ou BAIRRO monitorado: tocar abre o ponto no mapa ou a situação do bairro.
//
// Os bueiros, bairros e lugares conhecidos são achados na hora, no próprio aparelho. Os endereços
// vêm de um serviço de busca (src/rotas/servico.js) e chegam um instante depois.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { usePontos } from "../dados/PontosContexto";
import { resumirBairros } from "../dados/bairros";
import { semAcento } from "../dados/niveis";
import { compararPorGravidade, linhaSituacao, nivelVisivel } from "../dados/modelo";
import { useRotas } from "../rotas/RotaContexto";
import { LUGARES } from "../rotas/lugares";
import { useEnderecos } from "../rotas/useEnderecos";
import { Tampa } from "../componentes/Tampa";
import { BotaoVoltar, Tela } from "../componentes/Tela";
import { IconeBusca, IconeFechar, IconePino, IconeRota, IconeSeta } from "../componentes/Icones";

const normalizar = (texto) => semAcento(texto).toLowerCase().trim();

export default function Busca() {
  const { pontos, agora } = usePontos();
  const { origem, definirDestino } = useRotas();
  const navegar = useNavigate();
  const [texto, setTexto] = useState("");
  const campo = useRef(null);

  // O foco vai direto para o campo: a pessoa tocou em "buscar" para digitar. preventScroll evita
  // que o navegador role a página para "achar" o campo enquanto a tela ainda está subindo.
  useEffect(() => {
    campo.current?.focus({ preventScroll: true });
  }, []);

  const bairros = useMemo(() => resumirBairros(pontos, agora), [pontos, agora]);
  const termo = normalizar(texto);
  const enderecos = useEnderecos(texto);

  const lugaresConhecidos = useMemo(
    () => (termo ? LUGARES.filter((l) => normalizar(`${l.nome} ${l.detalhe}`).includes(termo)) : LUGARES.slice(0, 5)),
    [termo],
  );
  const bueirosAchados = useMemo(() => {
    if (!termo) return [];
    return pontos
      .filter((p) => normalizar(`${p.codigo} ${p.codigo.replace("-", "")} ${p.endereco ?? ""} ${p.bairro}`).includes(termo))
      .sort(compararPorGravidade)
      .slice(0, 8);
  }, [pontos, termo]);
  const bairrosAchados = termo ? bairros.filter((b) => normalizar(b.nome).includes(termo)) : [];

  // Sem texto, sugere o que mais importa agora: os pontos em nível alto ou crítico.
  const emAlerta = useMemo(
    () => pontos.filter((p) => (nivelVisivel(p, agora) ?? 0) >= 3).sort(compararPorGravidade).slice(0, 6),
    [pontos, agora],
  );

  const abrirNoMapa = (id) => navegar({ pathname: "/", search: `?ponto=${encodeURIComponent(id)}` });
  const abrirBairro = (nome) => navegar({ pathname: "/bairros", search: `?b=${encodeURIComponent(nome)}` });
  /**
   * Traça a rota até o lugar. Com a partida já conhecida vai direto para o mapa; sem ela, passa
   * pela tela de rotas, que tenta a posição do aparelho ou pede o ponto de partida. A busca sai
   * do histórico (replace): voltar da rota leva ao mapa, não de volta à lista.
   */
  const irPara = (lugar) => {
    definirDestino(lugar);
    navegar(origem ? "/rota" : "/rotas", { replace: true });
  };

  const lugares = [...lugaresConhecidos, ...enderecos.lugares];
  const procurando = enderecos.fase === "procurando" && enderecos.lugares.length === 0;
  const nadaAchado = termo && lugares.length === 0 && bueirosAchados.length === 0 && bairrosAchados.length === 0
    && (enderecos.fase === "pronta" || enderecos.fase === "erro" || termo.length < 3);

  const linhaLugar = (lugar) => (
    <button key={lugar.id} type="button" className="row row-2" onClick={() => irPara(lugar)}
      aria-label={`Traçar rota até ${lugar.nome}${lugar.detalhe ? `, ${lugar.detalhe}` : ""}`}>
      <span className="row-ic" aria-hidden="true"><IconePino pequeno /></span>
      <span className="row-k">{lugar.nome}{lugar.detalhe ? <span className="row-sub">{lugar.detalhe}</span> : null}</span>
      <span className="row-chev bs-rota" aria-hidden="true"><IconeRota pequeno /></span>
    </button>
  );
  const linhaBueiro = (p) => (
    <button key={p.id} type="button" className="row row-2" onClick={() => abrirNoMapa(p.id)}>
      <Tampa nivel={nivelVisivel(p, agora)} tamanho={30} />
      <span className="row-k">
        Bueiro {p.codigo}
        <span className="row-sub">{p.endereco ? `${p.endereco} · ${p.bairro}` : p.bairro}</span>
        <span className="row-sub">{linhaSituacao(p, agora)}</span>
      </span>
      <span className="row-chev"><IconeSeta pequeno /></span>
    </button>
  );

  return (
    <Tela titulo="Buscar">
      <div className="bs-bar">
        <BotaoVoltar rotulo="Voltar ao mapa" />
        <div className="bs-in" role="search">
          <IconeBusca />
          <input ref={campo} className="input" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Lugar, rua ou bueiro" aria-label="Buscar um lugar para ir, um bueiro ou um bairro" enterKeyHint="search" autoComplete="off" />
          {texto ? (
            <button type="button" className="bs-clear" onClick={() => setTexto("")} aria-label="Limpar busca"><IconeFechar pequeno /></button>
          ) : null}
        </div>
      </div>

      <div aria-live="polite">
        {nadaAchado ? (
          <p className="small bs-vazio">Nada encontrado para “{texto.trim()}”. Tente o nome da rua com o bairro, ou o código do bueiro.</p>
        ) : null}

        {lugares.length || procurando ? (
          <>
            <h2 className="grp-t">{termo ? "Ir para" : "Ir para um lugar"}</h2>
            {lugares.length ? <div className="grp">{lugares.map(linhaLugar)}</div> : null}
            {procurando ? <p className="small bs-vazio">Procurando endereços…</p> : null}
          </>
        ) : null}
        {enderecos.fase === "erro" && !nadaAchado ? (
          <p className="micro bs-nota">A busca de endereço não respondeu; aparecem só os lugares conhecidos e os bueiros.</p>
        ) : null}

        {bueirosAchados.length ? (
          <>
            <h2 className="grp-t">Bueiros</h2>
            <div className="grp">{bueirosAchados.map(linhaBueiro)}</div>
          </>
        ) : null}

        {bairrosAchados.length ? (
          <>
            <h2 className="grp-t">Bairros</h2>
            <div className="grp">
              {bairrosAchados.map((b) => (
                <button key={b.nome} type="button" className="row row-2" onClick={() => abrirBairro(b.nome)}>
                  <Tampa nivel={b.pior} tamanho={30} />
                  <span className="row-k">{b.nome}<span className="row-sub">{b.total} {b.total === 1 ? "bueiro monitorado" : "bueiros monitorados"}</span></span>
                  <span className="row-chev"><IconeSeta pequeno /></span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>

      {termo ? null : (
        <>
          {emAlerta.length ? (
            <>
              <h2 className="grp-t">Em nível alto ou crítico agora</h2>
              <div className="grp">{emAlerta.map(linhaBueiro)}</div>
            </>
          ) : null}
          {bairros.length ? (
            <>
              <h2 className="grp-t">Ver o risco de um bairro</h2>
              <div className="bs-chips">
                {bairros.map((b) => <button key={b.nome} type="button" className="chip" onClick={() => abrirBairro(b.nome)}>{b.nome}</button>)}
              </div>
            </>
          ) : null}
          <p className="micro bs-nota">
            Tocar num lugar traça a rota de carro até lá, desviando dos bueiros em nível alto ou crítico.
          </p>
        </>
      )}
    </Tela>
  );
}
