// Telas que fazem parte do app mas ainda não foram construídas. Em vez de um botão morto, cada
// uma diz o que vai fazer e do que depende. A tela "Sobre" também mora aqui por ser só texto.

import { Link } from "react-router";
import { CabecalhoTela, Tela } from "../componentes/Tela";

const TELAS = {
  reportar: {
    titulo: "Reportar problema",
    texto: "Aqui você vai poder avisar sobre bueiro entupido, tampa quebrada ou rua alagando, com foto e localização.",
    depende: ["O registro de relatos no servidor do SIMA"],
    urgente: true,
  },
  perfil: {
    titulo: "Perfil e conta",
    texto: "Com uma conta você vai poder salvar seus bairros, seguir bueiros, receber os avisos no celular e acompanhar seus relatos. O mapa continua aberto sem conta.",
    depende: ["O login no servidor do SIMA", "Notificações no aparelho"],
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
            <li>Quando um bueiro está em nível alto ou crítico, a <b>rua em volta dele</b> fica pintada da mesma cor, por cerca de 300 m para cada lado. É onde o risco está, não a mancha exata de um alagamento.</li>
            <li>O <b>aviso por região</b> junta os bueiros de uma subprefeitura e acerta mais do que um bueiro sozinho.</li>
            <li>“Sem previsão” não quer dizer “sem risco”: só que não há estimativa para aquele ponto.</li>
            <li>As <b>rotas</b> são de carro e desviam dos bueiros em nível alto ou crítico. Quando não há desvio, o app avisa por onde o caminho passa.</li>
          </ul>
        </div>
        <p style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
          <Link className="btn btn-bone" to="/ia">Como a IA funciona</Link>
          <Link className="btn btn-iron" to="/alertas">Avisos por região</Link>
        </p>
        <p className="small" style={{ marginTop: 16 }}>
          Em emergência, ligue <a href="tel:199">199</a> (Defesa Civil) ou <a href="tel:193">193</a> (Bombeiros).
        </p>
        <p className="micro" style={{ marginTop: 16 }}>
          Projeto de conclusão de curso. Mapa e traçado das ruas: © OpenStreetMap, OpenMapTiles e OpenFreeMap. Rotas: Valhalla, no servidor da FOSSGIS.
          Busca de endereço: Photon, da komoot.
        </p>
      </div>
    </Tela>
  );
}
