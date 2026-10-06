// Raiz do app: provedores de dados e as rotas.
//
// O mapa fica SEMPRE montado (recriá-lo a cada volta seria lento e perderia a posição). As outras
// telas são rotas que abrem por cima dele. O endereço usa "#" (HashRouter) para o app funcionar
// em qualquer hospedagem estática e dentro do Capacitor, sem configurar o servidor.

import { HashRouter, Navigate, Route, Routes } from "react-router";
import { ProvedorPreferencias } from "./preferencias/PreferenciasContexto";
import { ProvedorPontos } from "./dados/PontosContexto";
import { DefinicoesSvg } from "./componentes/Tampa";
import { ProvedorRota } from "./componentes/ganchos";
import Mapa from "./telas/Mapa";
import Bueiro from "./telas/Bueiro";
import Bairros from "./telas/Bairros";
import Busca from "./telas/Busca";
import Menu from "./telas/Menu";
import { EmConstrucao, Sobre } from "./telas/EmConstrucao";

export default function App() {
  return (
    <HashRouter>
      <ProvedorRota>
      <ProvedorPreferencias>
        <ProvedorPontos>
          <DefinicoesSvg />
          <div className="app">
            <Mapa />
            <Routes>
              <Route path="/" element={null} />
              <Route path="/busca" element={<Busca />} />
              <Route path="/bairros" element={<Bairros />} />
              <Route path="/bueiro/:id" element={<Bueiro />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/rotas" element={<EmConstrucao tela="rotas" />} />
              <Route path="/reportar" element={<EmConstrucao tela="reportar" />} />
              <Route path="/alertas" element={<EmConstrucao tela="alertas" />} />
              <Route path="/perfil" element={<EmConstrucao tela="perfil" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </ProvedorPontos>
      </ProvedorPreferencias>
      </ProvedorRota>
    </HashRouter>
  );
}
