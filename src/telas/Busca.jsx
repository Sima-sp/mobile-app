// Tela de busca: encontra bueiros (por código ou rua) e bairros entre os pontos monitorados.
// Ir até um endereço qualquer da cidade é com a tela de Rotas (src/telas/Rotas.jsx).

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { usePontos } from "../dados/PontosContexto";
import { resumirBairros } from "../dados/bairros";
import { semAcento } from "../dados/niveis";
import { compararPorGravidade, linhaSituacao, nivelVisivel } from "../dados/modelo";
import { Tampa } from "../componentes/Tampa";
import { BotaoVoltar, Tela } from "../componentes/Tela";
import { IconeBusca, IconeFechar, IconeSeta } from "../componentes/Icones";

const normalizar = (texto) => semAcento(texto).toLowerCase().trim();

export default function Busca() {
  const { pontos, agora } = usePontos();
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

  const bueirosAchados = useMemo(() => {
    if (!termo) return [];
    return pontos
      .filter((p) => normalizar(`${p.codigo} ${p.codigo.replace("-", "")} ${p.endereco ?? ""} ${p.bairro}`).includes(termo))
      .sort(compararPorGravidade)
      .slice(0, 12);
  }, [pontos, termo]);
  const bairrosAchados = termo ? bairros.filter((b) => normalizar(b.nome).includes(termo)) : [];

  // Sem texto, sugere o que mais importa agora: os pontos em nível alto ou crítico.
  const emAlerta = useMemo(
    () => pontos.filter((p) => (nivelVisivel(p, agora) ?? 0) >= 3).sort(compararPorGravidade).slice(0, 6),
    [pontos, agora],
  );

  const abrirNoMapa = (id) => navegar({ pathname: "/", search: `?ponto=${encodeURIComponent(id)}` });
  const abrirBairro = (nome) => navegar({ pathname: "/bairros", search: `?b=${encodeURIComponent(nome)}` });
  const nadaAchado = termo && bueirosAchados.length === 0 && bairrosAchados.length === 0;

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
            placeholder="Bueiro, rua ou bairro" aria-label="Buscar bueiro, rua ou bairro" enterKeyHint="search" autoComplete="off" />
          {texto ? (
            <button type="button" className="bs-clear" onClick={() => setTexto("")} aria-label="Limpar busca"><IconeFechar pequeno /></button>
          ) : null}
        </div>
      </div>

      <div aria-live="polite">
        {nadaAchado ? (
          <p className="small bs-vazio">Nada encontrado para “{texto.trim()}” entre os bueiros monitorados. Tente o nome da rua ou do bairro.</p>
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
          <p className="micro" style={{ padding: "22px 36px 0" }}>
            Esta busca cobre os bueiros monitorados. Para ir a um endereço, use <Link to="/rotas">Rotas</Link>.
          </p>
        </>
      )}
    </Tela>
  );
}
