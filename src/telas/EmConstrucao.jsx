// Telas que fazem parte do app mas ainda não foram construídas. Em vez de um botão morto, cada
// uma diz o que vai fazer e do que depende. A tela "Sobre" também mora aqui por ser só texto.

import { Link } from "react-router";
import { CabecalhoTela, Tela } from "../componentes/Tela";

const TELAS = {
  rotas: {
    titulo: "Rotas seguras",
    texto: "Aqui o SIMA vai traçar o caminho até o seu destino desviando dos bueiros em nível alto ou crítico.",
    depende: ["Um serviço de rotas que aceite áreas a evitar", "A busca por endereço"],
  },
  reportar: {
    titulo: "Reportar problema",
    texto: "Aqui você vai poder avisar sobre bueiro entupido, tampa quebrada ou rua alagando, com foto e localização.",
    depende: ["O registro de relatos no servidor do SIMA"],
    urgente: true,
  },
  alertas: {
    titulo: "Alertas",
    texto: "Aqui vão ficar os avisos dos bueiros e bairros que você acompanha.",
    depende: ["Alertas gerados a partir das previsões no servidor", "Notificações no aparelho"],
  },
  perfil: {
    titulo: "Perfil e conta",
    texto: "Com uma conta você vai poder salvar seus bairros, seguir bueiros e acompanhar seus relatos. O mapa continua aberto sem conta.",
    depende: ["O login no servidor do SIMA"],
  },
};

export function EmConstrucao({ tela }) {
  const { titulo, texto, depende, urgente } = TELAS[tela];
  return (
    <Tela titulo={titulo}>
      <CabecalhoTela titulo={titulo} />
      <div className="ec">
        <p className="sub" style={{ marginTop: 12 }}>{texto}</p>
        <div className="plate ec-card">
          <h2 className="label" style={{ color: "var(--bone-50)", fontSize: 15 }}>Ainda não está pronto</h2>
          <p className="small" style={{ marginTop: 6 }}>Esta tela entra numa próxima etapa do app. Ela depende de:</p>
          <ul className="ec-lista">{depende.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        {urgente ? (
          <p className="small" style={{ marginTop: 16 }}>
            Se a rua está alagando e há risco para alguém agora, ligue <a href="tel:199">199</a> (Defesa Civil) ou <a href="tel:193">193</a> (Bombeiros).
          </p>
        ) : null}
        <p style={{ marginTop: 24 }}><Link className="btn btn-iron" to="/">Voltar ao mapa</Link></p>
      </div>
    </Tela>
  );
}

export function Sobre() {
  return (
    <Tela titulo="Sobre o SIMA">
      <CabecalhoTela titulo="Sobre o SIMA" />
      <div className="ec">
        <p className="sub" style={{ marginTop: 12 }}>
          O SIMA (Sistema Inteligente de Monitoramento de Alagamentos em São Paulo) acompanha bueiros com sensores e estima a
          chance de cada ponto alagar nas próximas 3 horas.
        </p>
        <div className="plate ec-card">
          <h2 className="label" style={{ color: "var(--bone-50)", fontSize: 15 }}>Como ler o mapa</h2>
          <ul className="ec-lista">
            <li><b>Medido</b> é o que o sensor leu no bueiro: nível da água e lixo acumulado, com a hora da leitura.</li>
            <li><b>Previsto</b> é a estimativa da inteligência artificial a partir da chuva e dessas leituras. É uma chance, não uma certeza.</li>
            <li>A tampa enche conforme o risco: baixo, médio, alto e crítico.</li>
            <li>“Sem previsão” não quer dizer “sem risco”: só que não há estimativa para aquele ponto.</li>
          </ul>
        </div>
        <p className="small" style={{ marginTop: 16 }}>
          Em emergência, ligue <a href="tel:199">199</a> (Defesa Civil) ou <a href="tel:193">193</a> (Bombeiros).
        </p>
        <p className="micro" style={{ marginTop: 16 }}>Projeto de conclusão de curso. Mapa: © OpenStreetMap, OpenMapTiles e OpenFreeMap.</p>
      </div>
    </Tela>
  );
}
