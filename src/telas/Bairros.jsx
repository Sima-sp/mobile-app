// Tela Bairros: a situação de cada bairro num relance e os pontos que merecem atenção.
// O bairro escolhido fica no endereço (/bairros?b=Santana) para a busca poder abrir direto nele.
// O cartão do bairro também traz o aviso da região (src/dados/regioes.js): o que os bueiros dela
// dizem em conjunto. A lista de todas as regiões em aviso fica na tela Avisos.

import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { usePontos } from "../dados/PontosContexto";
import { resumirBairros } from "../dados/bairros";
import { ROTULO_AVISO, avisosPorRegiao, fraseDaRegiao } from "../dados/regioes";
import { ROTULO_NIVEL } from "../dados/niveis";
import { milimetros, nivelVisivel, porcento, resumoPrevisao } from "../dados/modelo";
import { SeloNivel, Tampa } from "../componentes/Tampa";
import { CabecalhoTela, Tela } from "../componentes/Tela";
import { IconeSeta } from "../componentes/Icones";

export default function Bairros() {
  const { pontos, agora, carregando } = usePontos();
  const [parametros, setParametros] = useSearchParams();
  const navegar = useNavigate();

  const bairros = useMemo(() => resumirBairros(pontos, agora), [pontos, agora]);
  const escolhido = bairros.find((b) => b.nome === parametros.get("b")) ?? bairros[0] ?? null;
  const regioes = useMemo(() => avisosPorRegiao(pontos, agora), [pontos, agora]);
  const regiao = escolhido ? regioes.find((r) => r.nome === escolhido.nome) ?? null : null;

  if (!escolhido) {
    return (
      <Tela titulo="Bairros">
        <CabecalhoTela titulo="Bairros" />
        <p className="sub" style={{ padding: "16px 20px" }}>
          {carregando ? "Carregando os bueiros…" : "Ainda não há bueiros monitorados para mostrar."}
        </p>
      </Tela>
    );
  }

  const comPrevisao = escolhido.total - escolhido.semPrevisao;
  const largura = (n) => (comPrevisao ? `${(n / comPrevisao) * 100}%` : "0%");
  const descricaoDaBarra = escolhido.contagem.map((n, i) => `${n} ${ROTULO_NIVEL[i + 1].toLowerCase()}`).join(", ");

  return (
    <Tela titulo="Bairros">
      <CabecalhoTela titulo="Bairros" />

      <div className="br-chips" role="group" aria-label="Escolha o bairro">
        {bairros.map((b) => (
          <button key={b.nome} type="button" className={b.nome === escolhido.nome ? "chip chip-on" : "chip"}
            aria-pressed={b.nome === escolhido.nome} onClick={() => setParametros({ b: b.nome }, { replace: true })}>
            {b.nome}
          </button>
        ))}
      </div>

      <section className="plate br-card" aria-label={`Resumo de ${escolhido.nome}`}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h2 className="h2">{escolhido.nome}</h2>
            <p className="micro" style={{ marginTop: 4 }}>
              <span className="mono">{escolhido.total}</span> {escolhido.total === 1 ? "bueiro" : "bueiros"}
              {escolhido.chuvaMedia === null ? null : <> · choveu {milimetros(escolhido.chuvaMedia)} em 3 h</>}
            </p>
          </div>
          <SeloNivel nivel={escolhido.pior} />
        </div>
        <div className="br-bar" role="img" aria-label={descricaoDaBarra}>
          {escolhido.contagem.map((n, i) => (n ? <i key={i} style={{ width: largura(n), background: `var(--r${i + 1})` }} /> : null))}
        </div>
        <div className="br-keys">
          {escolhido.contagem.map((n, i) => (
            <span key={i}><Tampa nivel={i + 1} tamanho={14} /><b className="mono">{n}</b> {ROTULO_NIVEL[i + 1].toLowerCase()}</span>
          ))}
          {escolhido.semPrevisao ? <span><Tampa nivel={null} tamanho={14} /><b className="mono">{escolhido.semPrevisao}</b> sem previsão</span> : null}
        </div>
        {regiao ? (
          <button type="button" className="br-regiao" onClick={() => navegar("/alertas")}>
            <span className={`av-marca av-marca-${regiao.nivel}`} aria-hidden="true" />
            <span className="br-regiao-texto">
              <b>{regiao.nivel ? `Aviso da região: ${ROTULO_AVISO[regiao.nivel].toLowerCase()}` : regiao.cobertura ? "Sem aviso para a região" : "Poucos bueiros para um aviso da região"}</b>
              <span>{fraseDaRegiao(regiao)}</span>
            </span>
            <IconeSeta pequeno />
          </button>
        ) : null}
      </section>

      <h2 className="grp-t">Bueiros do bairro, do mais grave ao mais tranquilo</h2>
      <div className="grp">
        {escolhido.pontos.map((p) => {
          const previsao = resumoPrevisao(p, agora);
          return (
            <button key={p.id} type="button" className="row row-2" onClick={() => navegar(`/bueiro/${encodeURIComponent(p.id)}`)}>
              <Tampa nivel={nivelVisivel(p, agora)} tamanho={30} />
              <span className="row-k">
                <span className="br-code">{p.codigo}</span>
                <span className="row-sub">{p.endereco ?? p.bairro}</span>
                {previsao.tipo === "probabilidade" ? null : <span className="row-sub">{previsao.titulo}</span>}
              </span>
              <span className="row-v mono">{p.agua === null ? "—" : porcento(p.agua)}</span>
              <span className="row-chev"><IconeSeta pequeno /></span>
            </button>
          );
        })}
      </div>
      <p className="micro" style={{ padding: "10px 36px 0" }}>A porcentagem ao lado é o nível da água medido pelo sensor.</p>
    </Tela>
  );
}
