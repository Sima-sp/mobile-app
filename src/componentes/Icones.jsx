// Ícones de traço do SIMA, todos na grade 24×24 e desenhados com a cor do texto (currentColor).
// São decorativos: quem dá o nome acessível é o botão ou o texto ao lado.

function Icone({ pequeno = false, children }) {
  return (
    <svg className={pequeno ? "ico ico-sm" : "ico"} viewBox="0 0 24 24" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconeMenu = (p) => <Icone {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Icone>;
export const IconeVoltar = (p) => <Icone {...p}><path d="M14.5 5.5 8 12l6.5 6.5" /></Icone>;
export const IconeFechar = (p) => <Icone {...p}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></Icone>;
export const IconeSeta = (p) => <Icone {...p}><path d="M9.5 5.5 16 12l-6.5 6.5" /></Icone>;
export const IconeBusca = (p) => <Icone {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></Icone>;
export const IconeCamadas = (p) => <Icone {...p}><path d="M12 4 3.5 8.5 12 13l8.5-4.5z" /><path d="M3.5 12.5 12 17l8.5-4.5M3.5 16.3 12 20.8l8.5-4.5" /></Icone>;
export const IconeLocalizar = (p) => <Icone {...p}><path d="M19.5 4.5 4.5 11l6.6 1.9 1.9 6.6z" /></Icone>;
export const IconePessoa = (p) => <Icone {...p}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 20.2c1.3-3.7 4-5.7 7.2-5.7s5.9 2 7.2 5.7" /></Icone>;
export const IconeRota = (p) => <Icone {...p}><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="6" r="2.2" /><path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.8" /></Icone>;
export const IconeMais = (p) => <Icone {...p}><path d="M12 5.5v13M5.5 12h13" /></Icone>;
export const IconeMapa = (p) => <Icone {...p}><path d="M3.5 6.5 9 4.2l6 2.3 5.5-2.3v13.3L15 19.8l-6-2.3-5.5 2.3z" /><path d="M9 4.2v13.3M15 6.5v13.3" /></Icone>;
export const IconeBairros = (p) => <Icone {...p}><path d="M4 20V10.5l4-2.5 4 2.5V20M12 20V6l4-2.5L20 6v14M3 20h18" /><path d="M7.5 13.5h1M7.5 16.5h1M15.5 9.5h1M15.5 12.5h1M15.5 15.5h1" /></Icone>;
export const IconeSino = (p) => <Icone {...p}><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2H4.4z" /><path d="M10 21h4" /></Icone>;
export const IconeLua = (p) => <Icone {...p}><path d="M19.5 14.2A8 8 0 0 1 9.8 4.5a8.2 8.2 0 1 0 9.7 9.7z" /></Icone>;
export const IconeSol = (p) => <Icone {...p}><circle cx="12" cy="12" r="4.2" /><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.8 5.8l1.7 1.7M16.5 16.5l1.7 1.7M18.2 5.8l-1.7 1.7M7.5 16.5l-1.7 1.7" /></Icone>;
// Rotas.
export const IconePino = (p) => <Icone {...p}><path d="M12 21s-6.5-5.7-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.3 12 21 12 21z" /><circle cx="12" cy="10.4" r="2.3" /></Icone>;
export const IconeInverter = (p) => <Icone {...p}><path d="M8 5v14M8 19l-3.2-3.2M8 19l3.2-3.2M16 19V5M16 5l-3.2 3.2M16 5l3.2 3.2" /></Icone>;
// Clima (usados no controle da demonstração).
const NUVEM = "M7 14.5a3.6 3.6 0 0 1 .4-7.18 5 5 0 0 1 9.5 1.2A3 3 0 0 1 16.6 14.5z";
export const IconeChuvisco = (p) => <Icone {...p}><path d={NUVEM} /><path d="M9.5 17.6v.9M14 17.6v.9" /></Icone>;
export const IconeChuva = (p) => <Icone {...p}><path d={NUVEM} /><path d="M8.6 17.2l-.9 2.6M12.2 17.2l-.9 2.6M15.8 17.2l-.9 2.6" /></Icone>;
export const IconeTempestade = (p) => <Icone {...p}><path d={NUVEM} /><path d="M12.6 15.6 10.4 19h3l-1.6 3.2" /><path d="M7.6 17.4l-.8 2.2M17 17.4l-.8 2.2" /></Icone>;
export const IconeInfo = (p) => <Icone {...p}><circle cx="12" cy="12" r="8.4" /><path d="M9.6 9.6a2.4 2.4 0 1 1 3.2 2.3c-.6.2-.8.7-.8 1.3v.5M12 16.6v.3" /></Icone>;
