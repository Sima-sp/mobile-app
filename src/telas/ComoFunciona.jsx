// Tela "Como a IA funciona": mostra a inteligência artificial do SIMA em funcionamento, sem
// termos técnicos. Tem três partes:
//   1. um SIMULADOR: a pessoa muda a chuva, o lugar e a leitura do sensor (água) e vê a resposta
//      (chance, nível e o porquê) mudar na hora. A IA junta as três coisas: a leitura do sensor
//      entra na conta da chance, não é só uma medição mostrada ao lado;
//   2. o caminho de uma previsão, em cinco passos;
//   3. quanto ela acerta, dito com franqueza (números dos testes do modelo v1).
//
// O simulador usa a mesma conta da demonstração do mapa (src/dados/simulador.js e demo.js). É uma
// versão simplificada para explicar; o modelo de verdade roda no servidor.
// Aberta pelo Menu, pela tela Sobre e pelo bloco "Previsão da IA" de um bueiro. Vindo de um
// bueiro (/ia?ponto=ID), o simulador já começa com o lugar e as leituras dele.

import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { usePontos } from "../dados/PontosContexto";
import { corNivel, rotuloNivel } from "../dados/niveis";
import { textoProbabilidade } from "../dados/modelo";
import {
  CENARIOS, LIMIARES_EM_TEXTO, LUGARES_DO_SIMULADOR, forcaDaChuva, fraseDoResultado, lugarDoPonto, responder,
} from "../dados/simulador";
import { Tampa } from "../componentes/Tampa";
import { CabecalhoTela, Tela } from "../componentes/Tela";
import { IconeSeta } from "../componentes/Icones";

const PASSOS = [
  { titulo: "Ela aprendeu com o passado",
    texto: "Estudou 12.621 alagamentos registrados em São Paulo desde 2011 e a chuva de cada hora. Assim aprendeu em que condições cada lugar costuma alagar." },
  { titulo: "A cada 10 minutos ela olha de novo",
    texto: "Recebe a chuva das últimas horas em cada ponto, o histórico do lugar e a última leitura do sensor: o nível da água no bueiro." },
  { titulo: "Calcula a chance pela chuva e pelo lugar",
    texto: "É a chance de alagar nas próximas 3 horas. Alagamento é raro, então os números são pequenos: 1% já é muito acima do normal." },
  { titulo: "O sensor entra na conta",
    texto: "Bueiro enchendo multiplica essa chance: é o sinal de que ali a água já não escoa. Bueiro cheio vira “Transbordando agora”, que é medição, não previsão." },
  { titulo: "A chance vira um nível", niveis: true,
    texto: `Médio a partir de ${LIMIARES_EM_TEXTO[2]}, alto a partir de ${LIMIARES_EM_TEXTO[3]} e crítico a partir de ${LIMIARES_EM_TEXTO[4]}. É o nível que aparece na tampa.` },
];

export default function ComoFunciona() {
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const { porId } = usePontos();

  // Vindo de um bueiro: o lugar dele (quando é um dos pontos conhecidos) e as leituras de agora.
  const inicio = useMemo(() => {
    const ponto = porId(parametros.get("ponto"));
    const lugar = ponto ? lugarDoPonto(ponto.id) : null;
    if (!ponto || !lugar) {
      // Sem bueiro: começa numa chuva forte num lugar que alaga às vezes, no meio da escala.
      const forte = CENARIOS.find((c) => c.id === "forte");
      return { lugares: LUGARES_DO_SIMULADOR, lugar: LUGARES_DO_SIMULADOR[1].id, chuva: Math.round(forte.chuva * 100), agua: forte.agua };
    }
    return {
      lugares: [{ ...lugar, rotulo: `Bueiro ${ponto.codigo}` }, ...LUGARES_DO_SIMULADOR.filter((l) => l.id !== lugar.id)],
      lugar: lugar.id,
      // Sem arredondar: a resposta inicial bate com a previsão que a tela do bueiro mostra.
      chuva: forcaDaChuva(ponto.chuvaRecente3h ?? 0) * 100,
      agua: Math.round(ponto.agua ?? 30),
    };
    // Só na abertura: depois disso quem manda nos controles é a pessoa.
  }, []);

  const [idLugar, setIdLugar] = useState(inicio.lugar);
  const [chuva, setChuva] = useState(inicio.chuva);
  const [agua, setAgua] = useState(inicio.agua);

  const lugar = inicio.lugares.find((l) => l.id === idLugar) ?? inicio.lugares[0];
  const resposta = responder({ chuva: chuva / 100, agua }, lugar);
  const cor = corNivel(resposta.nivel);
  // "< 0,1%" no lugar de "menos de 0,1%": a linha da chance não quebra em duas.
  const chance = textoProbabilidade(resposta.probabilidade).replace("menos de ", "< ");

  const aplicar = (cenario) => {
    setChuva(Math.round(cenario.chuva * 100));
    setAgua(cenario.agua);
  };
  const cenarioAtivo = CENARIOS.find((c) => Math.round(c.chuva * 100) === Math.round(chuva) && c.agua === agua)?.id;
  const passo = (id) => resposta.passos.find((p) => p.id === id);

  return (
    <Tela titulo="Como a IA funciona">
      <CabecalhoTela titulo="Como a IA funciona" />
      <p className="sub ia-intro">
        A inteligência artificial do SIMA junta três coisas para estimar a chance de cada bueiro alagar nas próximas 3 horas:
        a chuva, o histórico do lugar e a água que o sensor mede no bueiro. Mude cada uma e veja a resposta.
      </p>

      {/* A resposta fica presa no alto enquanto a pessoa mexe nos controles. */}
      <section className="plate ia-resposta" aria-label="Resposta da IA">
        <div className="ia-resposta-topo" role="status">
          <Tampa nivel={resposta.nivel} tamanho={54} />
          <div style={{ minWidth: 0 }}>
            <p className="ia-nivel" style={{ color: cor }}>
              {resposta.medicaoTransbordando ? "Transbordando agora" : `Risco ${rotuloNivel(resposta.nivel).toLowerCase()}`}
            </p>
            <p className="ia-chance">
              {resposta.medicaoTransbordando ? "Medido pelo sensor" : <><b>{chance}</b> de chance de alagar em 3 h</>}
            </p>
          </div>
        </div>
        <p className="small ia-frase">{fraseDoResultado(resposta)}</p>
      </section>

      <div className="ia-cenarios" role="group" aria-label="Situações prontas">
        {CENARIOS.map((c) => (
          <button key={c.id} type="button" className={c.id === cenarioAtivo ? "chip chip-on" : "chip"} aria-pressed={c.id === cenarioAtivo} onClick={() => aplicar(c)}>
            {c.rotulo}
          </button>
        ))}
      </div>

      <h2 className="grp-t">A chuva e o lugar</h2>
      <div className="grp ia-grupo">
        <Faixa id="ia-chuva" rotulo="Chuva nas últimas 3 horas" valor={chuva} aoMudar={setChuva} texto={passo("chuva").titulo} nota={passo("chuva").texto} />
        <div className="ia-ctl">
          <span className="ia-rotulo" id="ia-rotulo-lugar">Lugar</span>
          <div className="ia-lugares" role="group" aria-labelledby="ia-rotulo-lugar">
            {inicio.lugares.map((l) => (
              <button key={l.id} type="button" className={l.id === lugar.id ? "chip chip-on" : "chip"} aria-pressed={l.id === lugar.id} onClick={() => setIdLugar(l.id)}>
                {l.rotulo}
              </button>
            ))}
          </div>
          <p className="ia-valor">{lugar.nome} · {lugar.regiao}</p>
          <p className="micro ia-nota">{passo("lugar").texto}</p>
        </div>
      </div>

      <h2 className="grp-t">O sensor do bueiro</h2>
      <div className="grp ia-grupo">
        <Faixa id="ia-agua" rotulo="Água no bueiro" valor={agua} aoMudar={setAgua} texto={passo("agua").titulo} nota={passo("agua").texto} efeito={passo("agua").efeito} marca={50} />
      </div>
      <p className="micro ia-rodape">
        O simulador é uma versão simplificada, feita para explicar. No servidor do SIMA, quem calcula a chance pela chuva e pelo lugar é um modelo treinado com os registros.
      </p>

      <h2 className="grp-t">O caminho de uma previsão</h2>
      <ol className="grp ia-passos">
        {PASSOS.map((p, i) => (
          <li key={p.titulo} className="ia-passo">
            <span className="ia-num" aria-hidden="true">{i + 1}</span>
            <div style={{ minWidth: 0 }}>
              <h3 className="ia-passo-t">{p.titulo}</h3>
              <p className="small" style={{ marginTop: 4 }}>{p.texto}</p>
              {p.niveis ? (
                <div className="ia-niveis" aria-hidden="true">
                  {[1, 2, 3, 4].map((n) => <span key={n} style={{ color: corNivel(n) }}><Tampa nivel={n} tamanho={22} />{rotuloNivel(n)}</span>)}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <h2 className="grp-t">Quanto ela acerta</h2>
      <div className="ia-fatos">
        <div className="plate ia-fato">
          <p className="ia-fato-n">31%</p>
          <p className="small">dos alagamentos registrados foram avisados com nível alto, em média 2,4 horas antes, em anos que ela não tinha visto.</p>
        </div>
        <div className="plate ia-fato">
          <p className="ia-fato-t">Ela erra para o lado da cautela</p>
          <p className="small" style={{ marginTop: 6 }}>
            A maioria dos avisos de nível alto não é seguida de alagamento registrado. Leia o nível como “risco acima do normal”, não como certeza.
          </p>
        </div>
        <div className="plate ia-fato">
          <p className="ia-fato-t">O que ainda é regra</p>
          <p className="small" style={{ marginTop: 6 }}>
            O peso da chuva e do lugar ela aprendeu com os registros. O peso do sensor, por enquanto, é uma regra definida pelo grupo:
            ainda não há leituras de verdade suficientes para ela aprender sozinha. Os 31% acima são da IA sem o sensor.
          </p>
        </div>
        <div className="plate ia-fato">
          <p className="ia-fato-t">O que ela não vê</p>
          <p className="small" style={{ marginTop: 6 }}>
            A chuva chega a ela como estimativa para áreas de alguns quilômetros: uma pancada muito localizada pode passar sem aviso.
            E os registros de alagamento (do CGE, da Prefeitura) cobrem melhor as avenidas que as ruas de bairro.
          </p>
        </div>
      </div>

      <div className="grp" style={{ marginTop: 14 }}>
        <button type="button" className="row row-2" onClick={() => navegar("/alertas")}>
          <span className="row-k">Por região ela acerta mais<span className="row-sub">Juntando os bueiros de uma região, o aviso de risco alto acerta 5 vezes mais.</span></span>
          <span className="row-chev"><IconeSeta pequeno /></span>
        </button>
      </div>
    </Tela>
  );
}

/**
 * Controle deslizante de 0 a 100, com o valor dito em palavras ao lado e uma nota embaixo.
 * `marca` desenha um risco no ponto em que a leitura passa a pesar na chance.
 */
function Faixa({ id, rotulo, valor, aoMudar, texto, nota, efeito = null, marca = null }) {
  return (
    <div className="ia-ctl">
      <label className="ia-rotulo" htmlFor={id}>{rotulo}</label>
      <div className="ia-faixa-caixa">
        <input id={id} className="ia-faixa" type="range" min="0" max="100" step="1" value={Math.round(valor)} aria-valuetext={texto}
          style={{ "--pct": `${valor}%` }} onChange={(e) => aoMudar(Number(e.target.value))} />
        {marca === null ? null : <span className="ia-marca" style={{ left: `calc(14px + (100% - 28px) * ${marca / 100})` }} aria-hidden="true" />}
      </div>
      <p className={`ia-valor ${efeito ? `ia-valor-${efeito}` : ""}`}>{texto}</p>
      <p className="micro ia-nota">{nota}</p>
    </div>
  );
}
