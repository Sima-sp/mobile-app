// Raiz do app: provedores de dados e as rotas.
//
// O mapa fica SEMPRE montado (recriá-lo a cada volta seria lento e perderia a posição). As outras
// telas são rotas que abrem por cima dele. O endereço usa "#" (HashRouter) para o app funcionar
// em qualquer hospedagem estática e dentro do Capacitor, sem configurar o servidor.

import { HashRouter, Navigate, Route, Routes } from "react-router";
import { ProvedorPreferencias } from "./preferencias/PreferenciasContexto";
import { ProvedorPontos } from "./dados/PontosContexto";
import { ProvedorRotas } from "./rotas/RotaContexto";
import { DefinicoesSvg } from "./componentes/Tampa";
import { ProvedorRota } from "./componentes/ganchos";
import Mapa from "./telas/Mapa";
import Bueiro from "./telas/Bueiro";
import Bairros from "./telas/Bairros";
import Busca from "./telas/Busca";
import Menu from "./telas/Menu";
import Rotas from "./telas/Rotas";
import Avisos from "./telas/Avisos";
import ComoFunciona from "./telas/ComoFunciona";
import { EmConstrucao, Sobre } from "./telas/EmConstrucao";
import { PrimeiroUso, ProvedorApresentacao } from "./componentes/PrimeiroUso";

export default function App() {
  return (
    <HashRouter>
      <ProvedorRota>
      <ProvedorPreferencias>
        <ProvedorPontos>
        <ProvedorRotas>
        <ProvedorApresentacao>
          <DefinicoesSvg />
          <div className="app">
            <Mapa />
            <Routes>
              <Route path="/" element={null} />
              {/* Modo rota: nenhuma tela por cima; o próprio mapa mostra o caminho e o cartão. */}
              <Route path="/rota" element={null} />
              <Route path="/busca" element={<Busca />} />
              <Route path="/bairros" element={<Bairros />} />
              <Route path="/bueiro/:id" element={<Bueiro />} />
              <Route path="/menu" element={<Menu />} />
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/rotas" element={<Rotas />} />
              <Route path="/reportar" element={<EmConstrucao tela="reportar" />} />
              <Route path="/alertas" element={<Avisos />} />
              <Route path="/ia" element={<ComoFunciona />} />
              <Route path="/perfil" element={<EmConstrucao tela="perfil" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            {/* Apresentação de primeiro uso: por cima de tudo, só na primeira abertura. */}
            <PrimeiroUso />
          </div>
        </ProvedorApresentacao>
        </ProvedorRotas>
        </ProvedorPontos>
      </ProvedorPreferencias>
      </ProvedorRota>
    </HashRouter>
  );
}
