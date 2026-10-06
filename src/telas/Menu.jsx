// Menu: atalhos para as telas e os ajustes do app (o app não tem barra de abas; tudo sai daqui).
// Só aparecem ajustes que já funcionam. Avisos, conta e idioma entram com as próximas etapas.

import { useNavigate } from "react-router";
import { usePreferencias } from "../preferencias/PreferenciasContexto";
import { usePontos } from "../dados/PontosContexto";
import { horaCurta } from "../dados/modelo";
import { BotaoVoltar, Tela } from "../componentes/Tela";
import { IconeBairros, IconeInfo, IconeLua, IconeMais, IconeMapa, IconePessoa, IconeRota, IconeSeta, IconeSino, IconeSol } from "../componentes/Icones";

const VERSAO = "0.1";

export default function Menu() {
  const navegar = useNavigate();
  const { tema, animacoes, abrirEmCalor, mudar } = usePreferencias();
  const { fonte, atualizadoEm, erro } = usePontos();

  // Ícones do menu sem cor: no app, cor é reservada ao risco (as quatro do nível) e à ação (azul).
  const atalho = (rotulo, caminho, icone, emBreve = false) => (
    <button type="button" className="row" onClick={() => navegar(caminho)}>
      <span className="row-ic" aria-hidden="true">{icone}</span>
      <span className="row-k">{rotulo}</span>
      {emBreve ? <span className="row-v">Em breve</span> : null}
      <span className="row-chev"><IconeSeta pequeno /></span>
    </button>
  );

  let origem = "Dados de demonstração";
  if (fonte === "api") origem = erro ? "Sem conexão com o servidor" : `Dados do servidor · ${atualizadoEm ? `atualizados às ${horaCurta(atualizadoEm)}` : "carregando"}`;

  return (
    <Tela titulo="Menu">
      <header className="mu-top"><BotaoVoltar fechar /></header>
      <div className="ltitle" style={{ paddingTop: 0 }}><h1 className="h1">Menu</h1></div>

      <div className="grp" style={{ marginTop: 18 }}>
        <button type="button" className="row row-2" onClick={() => navegar("/perfil")}>
          <span className="mu-av" aria-hidden="true"><IconePessoa /></span>
          <span className="row-k" style={{ fontSize: 17.5 }}>Entrar ou criar conta<span className="row-sub">Em breve · o mapa funciona sem conta</span></span>
          <span className="row-chev"><IconeSeta pequeno /></span>
        </button>
      </div>

      <h2 className="grp-t">Ir para</h2>
      <div className="grp">
        {atalho("Mapa", "/", <IconeMapa pequeno />)}
        {atalho("Bairros", "/bairros", <IconeBairros pequeno />)}
        {atalho("Rotas", "/rotas", <IconeRota pequeno />)}
        {atalho("Reportar problema", "/reportar", <IconeMais pequeno />, true)}
        {atalho("Alertas", "/alertas", <IconeSino pequeno />, true)}
      </div>

      <h2 className="grp-t">Aparência</h2>
      <div className="grp" style={{ padding: 10 }}>
        <div className="seg mu-seg" role="group" aria-label="Tema do aplicativo">
          <button type="button" className={tema === "escuro" ? "seg-on" : ""} aria-pressed={tema === "escuro"} onClick={() => mudar({ tema: "escuro" })}>
            <IconeLua pequeno />Noturno
          </button>
          <button type="button" className={tema === "claro" ? "seg-on" : ""} aria-pressed={tema === "claro"} onClick={() => mudar({ tema: "claro" })}>
            <IconeSol pequeno />Claro
          </button>
        </div>
      </div>

      <h2 className="grp-t" id="rotulo-animacoes">Animações</h2>
      <div className="grp" style={{ padding: 10 }}>
        <div className="seg mu-seg" role="group" aria-labelledby="rotulo-animacoes">
          {[["sistema", "Do aparelho"], ["ligadas", "Ligadas"], ["reduzidas", "Reduzidas"]].map(([valor, rotulo]) => (
            <button key={valor} type="button" className={animacoes === valor ? "seg-on" : ""} aria-pressed={animacoes === valor}
              onClick={() => mudar({ animacoes: valor })}>{rotulo}</button>
          ))}
        </div>
      </div>
      <p className="micro" style={{ padding: "8px 36px 0" }}>
        “Do aparelho” segue a configuração de acessibilidade do celular ou computador.
      </p>

      <h2 className="grp-t">Mapa</h2>
      <div className="grp">
        <div className="row row-flat">
          <span className="row-k" id="rotulo-calor">Abrir o mapa em calor</span>
          <button type="button" className={abrirEmCalor ? "tgl tgl-on" : "tgl"} role="switch" aria-checked={abrirEmCalor}
            aria-labelledby="rotulo-calor" onClick={() => mudar({ abrirEmCalor: !abrirEmCalor })}><span /></button>
        </div>
      </div>

      <h2 className="grp-t">Sobre</h2>
      <div className="grp">
        {atalho("Sobre o SIMA", "/sobre", <IconeInfo pequeno />)}
      </div>

      <p className="micro mu-foot">SIMA · versão {VERSAO}<br />{origem}</p>
    </Tela>
  );
}
