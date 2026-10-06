// Tela de um bueiro: tudo o que se sabe sobre o ponto.
// Regra de ouro do SIMA: o que foi MEDIDO pelo sensor (água, lixo, hora da leitura) aparece
// separado do que foi PREVISTO pela IA (nível de risco e chance nas próximas horas).

import { useNavigate, useParams } from "react-router";
import { usePontos } from "../dados/PontosContexto";
import { corNivel, rotuloNivel } from "../dados/niveis";
import { haQuanto, horaCurta, leituraRecente, milimetros, nivelVisivel, porcento, statusAgora, textoProbabilidade } from "../dados/modelo";
import { SeloNivel } from "../componentes/Tampa";
import { BotaoVoltar, Tela } from "../componentes/Tela";
import { IconeMais, IconeMapa, IconeRota, IconeSeta } from "../componentes/Icones";

export default function Bueiro() {
  const { id } = useParams();
  const { porId, agora, carregando, fonte } = usePontos();
  const navegar = useNavigate();
  const ponto = porId(id);

  if (!ponto) {
    return (
      <Tela titulo="Bueiro">
        <header className="nav"><BotaoVoltar /></header>
        <div className="ec">
          <h1 className="h1">{carregando ? "Carregando…" : "Bueiro não encontrado"}</h1>
          {carregando ? null : <p className="sub" style={{ marginTop: 10 }}>Este ponto não está na lista de bueiros monitorados.</p>}
        </div>
      </Tela>
    );
  }

  const nivel = nivelVisivel(ponto, agora);
  const cor = corNivel(nivel);
  const temLeitura = ponto.agua !== null && !ponto.semLeituraSensor && ponto.statusSensor !== "INATIVO";

  return (
    <Tela titulo={`Bueiro ${ponto.codigo}`}>
      <header className="bu-head">
        <BotaoVoltar />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="bu-titulo">Bueiro {ponto.codigo}</h1>
          <p className="micro bu-sub">{ponto.endereco ? `${ponto.endereco} · ${ponto.bairro}` : ponto.bairro}</p>
        </div>
        <SeloNivel nivel={nivel} />
      </header>

      <section className="bu-gauge" aria-label="Nível da água medido agora">
        <TampaGrande agua={temLeitura ? ponto.agua : null} cor={temLeitura ? cor : "var(--iron-400)"} />
        <p className="micro" style={{ marginTop: 8, textAlign: "center" }}>{textoDoSensor(ponto, agora)}</p>
      </section>

      <div className="bu-cards">
        <div className="bu-card">
          <span className="label">Lixo acumulado</span>
          <div className="bu-num">{temLeitura ? porcento(ponto.lixo) : "—"}</div>
          <div className="bu-track"><i style={{ width: `${temLeitura ? Math.min(100, ponto.lixo ?? 0) : 0}%`, background: cor }} /></div>
          <p className="micro" style={{ marginTop: 8 }}>{temLeitura ? "Medido pelo sensor" : "Sem leitura do sensor"}</p>
        </div>
        <div className="bu-card">
          <span className="label">Chuva em 3 h</span>
          <div className="bu-num">
            {ponto.chuvaRecente3h === null ? "—" : <>{milimetros(ponto.chuvaRecente3h).replace(" mm", "")}<span className="bu-un">mm</span></>}
          </div>
          <div className="bu-track"><i style={{ width: `${Math.min(100, ((ponto.chuvaRecente3h ?? 0) / 50) * 100)}%`, background: "var(--route)" }} /></div>
          <p className="micro" style={{ marginTop: 8 }}>
            {ponto.chuvaPrevista3h === null ? "Sem previsão de chuva" : `Mais ${milimetros(ponto.chuvaPrevista3h)} previstos em 3 h`}
          </p>
        </div>
      </div>

      <section className="bu-sec" aria-label="Previsão">
        <PlacaPrevisao ponto={ponto} agora={agora} />
        <button type="button" className="bu-como" onClick={() => navegar({ pathname: "/ia", search: `?ponto=${encodeURIComponent(ponto.id)}` })}>
          Como a IA chega a esse nível<IconeSeta pequeno />
        </button>
      </section>

      {ponto.historicoAgua ? (
        <section className="bu-sec" aria-label="Nível da água nas últimas 12 horas">
          <h2 className="h2" style={{ fontSize: 21 }}>Nível da água · 12 h</h2>
          <GraficoAgua serie={ponto.historicoAgua} />
        </section>
      ) : null}

      <section className="bu-sec" aria-label="Sobre este ponto">
        <h2 className="h2" style={{ fontSize: 21 }}>Sobre este ponto</h2>
        <div className="grp" style={{ margin: "14px 0 0" }}>
          <div className="bu-fact"><span>Bairro</span><b>{ponto.bairro}</b></div>
          {ponto.statusSensor ? (
            <div className="bu-fact"><span>Sensor</span><b>{{ ATIVO: "Ativo", INATIVO: "Inativo", MANUTENCAO: "Em manutenção" }[ponto.statusSensor] ?? ponto.statusSensor}</b></div>
          ) : null}
          {ponto.freqHistorica !== null && ponto.freqHistorica !== undefined ? (
            <div className="bu-fact"><span>Alagamentos por ano perto daqui</span><b className="mono">{ponto.freqHistorica.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</b></div>
          ) : null}
          {ponto.modeloVersao ? <div className="bu-fact"><span>Modelo de IA</span><b className="mono">{ponto.modeloVersao}</b></div> : null}
          <div className="bu-fact"><span>Origem dos dados</span><b>{fonte === "demo" ? "Demonstração" : "Rede de sensores"}</b></div>
        </div>
      </section>

      <div className="bu-actions">
        <button type="button" className="btn btn-bone" onClick={() => navegar({ pathname: "/", search: `?ponto=${encodeURIComponent(ponto.id)}` })}>
          <IconeMapa pequeno />Ver no mapa
        </button>
        <button type="button" className="btn btn-iron" onClick={() => navegar("/rotas")}>
          <IconeRota pequeno />Desviar deste ponto
        </button>
        <button type="button" className="btn btn-line" onClick={() => navegar("/reportar")}>
          <IconeMais pequeno />Reportar problema aqui
        </button>
      </div>
    </Tela>
  );
}

function textoDoSensor(ponto, agora) {
  if (ponto.statusSensor === "INATIVO") return "Sensor inativo · sem leitura neste ponto";
  if (ponto.statusSensor === "MANUTENCAO") return "Sensor em manutenção · sem leitura no momento";
  if (ponto.agua === null || ponto.semLeituraSensor) return "Sem leitura recente do sensor";
  if (!leituraRecente(ponto, agora)) return `Última leitura ${haQuanto(ponto.leituraEm, agora)} · sensor sem enviar dados desde então`;
  return `Sensor online · leitura ${haQuanto(ponto.leituraEm, agora)}`;
}

/**
 * Letras estampadas em arco na borda da tampa, uma a uma e com o mesmo espaço entre elas.
 * Colocar letra por letra (em vez de deixar o navegador distribuir o texto no círculo) garante o
 * mesmo resultado em qualquer aparelho e fonte: a frase fica sempre centrada.
 *
 * @param {string} texto
 * @param {"cima"|"baixo"} lado  em cima o texto acompanha o arco; embaixo fica de pé, como em selos
 */
function LetrasEmArco({ texto, lado }) {
  const PASSO = 6.5; // graus entre uma letra e a próxima
  const letras = [...texto];
  const meio = (letras.length - 1) / 2;
  // A faixa das letras vai do raio 96 ao 108. Em cima a base da letra fica para dentro; embaixo, para fora.
  const y = lado === "cima" ? 120 - 97.5 : 120 + 107;
  return letras.map((letra, i) => {
    const angulo = (lado === "cima" ? i - meio : meio - i) * PASSO;
    return <text key={i} x="120" y={y} textAnchor="middle" transform={`rotate(${angulo} 120 120)`}>{letra}</text>;
  });
}

/** A tampa grande, que enche com o nível da água medido. Sem leitura, fica vazia e mostra um traço. */
function TampaGrande({ agua, cor }) {
  const temLeitura = agua !== null;
  // O disco interno vai de y = 40 (cheio) a y = 200 (vazio).
  const topoDaAgua = 200 - Math.min(100, Math.max(0, agua ?? 0)) * 1.6;
  const descricao = temLeitura ? `Tampa do bueiro com água em ${Math.round(agua)}% da capacidade` : "Tampa do bueiro sem leitura do sensor";
  // Quatro rebites no anel de dentro, nas diagonais: longe das letras, que ficam na borda de fora.
  const rebites = [45, 135, 225, 315].map((graus) => {
    const rad = (graus * Math.PI) / 180;
    return { x: 120 + 88 * Math.cos(rad), y: 120 + 88 * Math.sin(rad) };
  });
  return (
    <div className="bu-disco">
      <svg width="250" height="250" viewBox="0 0 240 240" role="img" aria-label={descricao}>
        <defs>
          <clipPath id="bu-disc"><circle cx="120" cy="120" r="80" /></clipPath>
        </defs>
        <circle cx="120" cy="120" r="113" strokeWidth="2" style={{ fill: "var(--iron-900)", stroke: "var(--iron-500)" }} />
        <circle cx="120" cy="120" r="88" strokeWidth="10" style={{ fill: "var(--iron-800)", stroke: "var(--iron-700)" }} />
        <g style={{ fill: "var(--iron-400)" }}>
          {rebites.map((r, i) => <circle key={i} cx={r.x} cy={r.y} r="2.6" />)}
        </g>
        <g className="bu-estampa" aria-hidden="true">
          <LetrasEmArco texto="MONITORAMENTO DE ALAGAMENTOS" lado="cima" />
          <LetrasEmArco texto="SIMA · SÃO PAULO" lado="baixo" />
        </g>
        <circle cx="120" cy="120" r="80" style={{ fill: "var(--lid-bg)" }} />
        <g clipPath="url(#bu-disc)">
          {temLeitura ? (
            <g className="bu-water"><rect x="20" y={topoDaAgua} width="200" height="200" style={{ fill: cor, opacity: 0.9 }} /></g>
          ) : null}
          <g strokeWidth="9" strokeLinecap="round" style={{ stroke: "var(--lid-bg)" }}>
            <path d="M80 46v148" /><path d="M100 42v156" /><path d="M120 40v160" /><path d="M140 42v156" /><path d="M160 46v148" />
          </g>
        </g>
        <circle cx="120" cy="120" r="80" fill="none" strokeWidth="3" style={{ stroke: cor }} />
        <circle cx="120" cy="120" r="50" opacity="0.97" style={{ fill: "var(--lid-bg)" }} />
      </svg>
      <div className="bu-centro">
        <span className="mono bu-pct">{temLeitura ? porcento(agua) : "—"}</span>
        <span className="micro" style={{ marginTop: 4 }}>{temLeitura ? "da capacidade" : "sem leitura"}</span>
      </div>
    </div>
  );
}

/**
 * Bloco da previsão. O nível é a informação principal; a porcentagem vem em segundo plano, com
 * uma frase que explica por que um número pequeno já pode ser risco alto.
 */
function PlacaPrevisao({ ponto, agora }) {
  const status = statusAgora(ponto, agora);
  const nivel = nivelVisivel(ponto, agora);

  if (ponto.medicaoTransbordando) {
    return (
      <div className="plate bu-ia">
        <div className="bu-ia-num"><div className="bu-ia-grande" style={{ color: "var(--r4)" }}>Agora</div><div className="micro" style={{ marginTop: 4 }}>medido</div></div>
        <div>
          <h2 className="label" style={{ color: "var(--bone-50)", fontSize: 15 }}>Transbordando agora</h2>
          <p className="small" style={{ marginTop: 6 }}>O sensor mediu o bueiro cheio. Isto é uma medição, não uma previsão.</p>
          <p className="micro" style={{ marginTop: 8 }}>Se há risco para alguém, ligue 199 (Defesa Civil) ou 193 (Bombeiros).</p>
        </div>
      </div>
    );
  }
  if (status === "SEM_PREVISAO") {
    return (
      <div className="plate bu-ia">
        <div className="bu-ia-num"><div className="bu-ia-grande" style={{ color: "var(--bone-500)" }}>—</div></div>
        <div>
          <h2 className="label" style={{ color: "var(--bone-50)", fontSize: 15 }}>Sem previsão</h2>
          <p className="small" style={{ marginTop: 6 }}>Ainda não há estimativa para este ponto. Isso não quer dizer que não há risco.</p>
        </div>
      </div>
    );
  }
  if (status === "DESATUALIZADA") {
    return (
      <div className="plate bu-ia">
        <div className="bu-ia-num"><div className="bu-ia-grande" style={{ color: "var(--bone-500)" }}>{rotuloNivel(nivel)}</div><div className="micro" style={{ marginTop: 4 }}>às {horaCurta(ponto.geradaEm)}</div></div>
        <div>
          <h2 className="label" style={{ color: "var(--bone-50)", fontSize: 15 }}>Previsão desatualizada</h2>
          <p className="small" style={{ marginTop: 6 }}>A última estimativa passou da validade. O nível ao lado pode não valer mais.</p>
        </div>
      </div>
    );
  }

  const chance = textoProbabilidade(ponto.probabilidade);
  return (
    <div className="plate bu-ia">
      <div className="bu-ia-num">
        <div className="bu-ia-grande" style={{ color: corNivel(nivel) }}>{rotuloNivel(nivel)}</div>
        <div className="micro" style={{ marginTop: 4 }}>{chance ? `${chance} de chance` : "por regras"}</div>
      </div>
      <div>
        <h2 className="label" style={{ color: "var(--bone-50)", fontSize: 15 }}>{chance ? "Previsão da IA" : "Estimativa por regras"}</h2>
        <p className="small" style={{ marginTop: 6 }}>
          Risco de alagar nas próximas {ponto.janelaHoras} h, pela chuva{ponto.semLeituraSensor ? " (sem a leitura do sensor)" : " e pelas leituras deste ponto"}.
        </p>
        {ponto.ajusteSensorAplicado && ponto.nivelModelo && ponto.nivelModelo < nivel ? (
          <p className="micro" style={{ marginTop: 8 }}>
            Pela chuva o risco seria {rotuloNivel(ponto.nivelModelo).toLowerCase()}; a leitura do sensor levou a {rotuloNivel(nivel).toLowerCase()}.
          </p>
        ) : null}
        {chance ? <p className="micro" style={{ marginTop: 8 }}>Alagamento é raro: na maior parte do tempo essa chance fica abaixo de 0,5%.</p> : null}
        <p className="micro" style={{ marginTop: 8 }}>É uma estimativa — não uma certeza. Feita às {horaCurta(ponto.geradaEm)}.</p>
      </div>
    </div>
  );
}

/** Curva do nível da água (uma leitura por hora, a última é a de agora). */
function GraficoAgua({ serie }) {
  const x = (i) => 8 + (i * 302) / (serie.length - 1);
  const y = (v) => 104 - (Math.min(100, v) / 100) * 92;
  const linha = serie.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const ultimo = serie[serie.length - 1];
  return (
    <div className="plate" style={{ marginTop: 12, padding: "16px 14px 10px" }}>
      <svg width="100%" height="132" viewBox="0 0 318 132" role="img"
        aria-label={`Nível da água foi de ${serie[0]}% para ${ultimo}% nas últimas 12 horas`}>
        <defs>
          <linearGradient id="bu-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f7fd6" stopOpacity="0.30" /><stop offset="1" stopColor="#2f7fd6" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g strokeWidth="1" style={{ stroke: "var(--glass-line)" }}><path d="M8 104h302" /><path d="M8 58h302" /></g>
        <path d="M8 12h302" strokeWidth="1.5" strokeDasharray="6 6" fill="none" style={{ stroke: "var(--r4)" }} />
        <text x="8" y="28" fontSize="12" style={{ fill: "var(--r4)", fontFamily: "var(--f-ui)" }}>transborda em 100%</text>
        <path d={`${linha} L310 104 L8 104 Z`} fill="url(#bu-fill)" />
        <path d={linha} fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--route)" }} />
        <circle cx={x(serie.length - 1)} cy={y(ultimo)} r="5" strokeWidth="2.5" style={{ fill: "var(--route)", stroke: "var(--card)" }} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 6px" }}>
        <span className="micro mono">12 h atrás</span><span className="micro mono">6 h</span>
        <span className="micro mono" style={{ color: "var(--bone-100)" }}>agora {porcento(ultimo)}</span>
      </div>
    </div>
  );
}
