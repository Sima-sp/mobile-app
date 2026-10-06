# SIMA · App

App do **SIMA-SP** (Sistema Inteligente de Monitoramento de Alagamentos em São Paulo): o mapa de
risco por bueiro monitorado, com o que o sensor mediu e o que a IA prevê para as próximas 3 horas.

Feito em **React + Vite**, a partir do desenho "liquid glass" do canvas *SIMA · app e site* (o mesmo
sistema visual da landing). Funciona no navegador do celular e do computador; o plano é empacotar
com Capacitor para gerar o APK.

## Rodar

```bash
npm install
npm run dev       # http://localhost:5173
npm run dev:rede  # igual, mas acessível pelo celular na mesma rede
npm run demo      # força a demonstração, mesmo com backend configurado no .env.local
npm run demo:rede # demonstração acessível pelo celular na mesma rede
npm test          # testes das regras de dados
npm run build     # gera a pasta dist/ (HTML/CSS/JS puro)
npm run build:demo  # o mesmo, já em modo demonstração (para publicar a versão da feira)
npm run preview   # serve a dist/ para conferir o build
```

Requer Node 20.19+ ou 22.12+. Sem configuração nenhuma o app abre com **dados de demonstração**.

## Demonstração (para apresentar o projeto)

```bash
npm run demo
```

Mostra **136 bueiros espalhados pela capital**, todos com sensor funcionando, e um controle de
**clima** no topo do mapa: sol, chuvisco, chuva forte e chuva extrema. No computador, as teclas
**1, 2, 3 e 4** fazem o mesmo que os botões. Ao trocar, a chuva "entra" pela cidade de oeste para
leste e os bueiros vão mudando em cerca de 12 segundos.

O aviso "Demonstração" fica sempre na tela. O que é real e o que é inventado:

- **Reais:** os lugares. São os pontos de alagamento recorrente que o modelo de IA conhece
  (`src/dados/pontosCapital.js`), com a frequência histórica de cada um.
- **Inventados:** as leituras, a chuva e as previsões. Mas seguem a lógica do sistema de verdade
  (`src/dados/demo.js`): quem alaga mais e está perto de córrego reage mais; a chance vira nível
  pelos limiares reais do modelo; água em 100 % é "transbordando agora"; lixo alto com chuva sobe
  um nível.

| Clima | O que aparece |
|---|---|
| Sol | Tudo em nível baixo |
| Chuvisco | Maioria em baixo; os bueiros com muito lixo vão para médio |
| Chuva forte | De tudo um pouco, com alguns críticos |
| Chuva extrema | Maioria em alto ou crítico; cerca de 15 bueiros transbordando |

No mapa afastado, bueiros próximos viram um **anel com a quantidade no meio**: cada cor do anel é
a parte do grupo naquele nível. Tocar no anel aproxima.

Para a feira: o mapa de fundo (ruas) vem da internet, então o computador ou celular precisa estar
conectado. Sem internet os bueiros e os dados continuam aparecendo, mas sobre um fundo liso.

## Publicar e instalar no celular

O arquivo `.github/workflows/publicar.yml` publica a demonstração no **GitHub Pages** a cada envio
para a branch `main`: roda os testes, gera o app com `npm run build:demo` e publica a pasta `dist/`.
O endereço fica `https://<organização>.github.io/<repositório>/`, em `https`.

Uma vez só, no repositório: **Settings → Pages → Source: GitHub Actions**. Em organização no plano
gratuito o Pages só funciona em repositório público.

Com o endereço `https` o app pode ser instalado:

- **iPhone:** abrir no Safari → botão Compartilhar → **Adicionar à Tela de Início**.
- **Android:** abrir no Chrome → menu → **Instalar app** (ou "Adicionar à tela inicial").

Instalado, ele abre em tela cheia, com o ícone do SIMA (`public/manifest.webmanifest` e os
`public/icone-*.png`), e o botão "onde estou" passa a funcionar, porque o celular só libera a
localização em endereços `https`.

## Gestos e animações

- O **cartão do bueiro** acompanha o dedo: puxar para baixo fecha, puxar para cima abre a tela
  completa do bueiro, um arrasto curto volta ao lugar (`src/componentes/arrastar.js`).
- A **barra de busca** tem um pegador: puxá-la para cima abre a busca.
- As telas **sobem de baixo** quando a pessoa vem do mapa e **descem** ao fechar. Entre uma tela e
  outra (Menu → Bairros) é só um esmaecer rápido (`src/componentes/Tela.jsx`).
- **Menu → Animações**: "Do aparelho" segue a configuração de acessibilidade do celular ou
  computador (quem pede menos movimento não vê nada deslizando); "Ligadas" e "Reduzidas" valem
  sempre. Se nada estiver animando no seu computador, é provável que o sistema esteja pedindo
  movimento reduzido: escolha "Ligadas".

## Rotas de carro

O botão azul do mapa (ou "Desviar", no cartão de um bueiro em risco) abre as rotas. A pessoa
escolhe o destino e a partida (a posição do aparelho, um endereço digitado ou um lugar conhecido)
e o caminho aparece no mapa, com um cartão que diz:

- **Caminho livre**: o caminho mais rápido não passa por bueiro em risco.
- **Rota segura**: há um desvio que evita todos; o cartão diz quantos minutos ele custa a mais e
  deixa comparar com o caminho mais rápido.
- **Rota com menos risco**: o melhor desvio achado ainda passa por algum ponto.
- **Sem desvio possível**: não há outro trajeto; o app mostra por quais bueiros o caminho passa.

"Em risco" é nível alto, crítico ou transbordando. A rota se refaz sozinha quando essa lista muda;
na demonstração, basta trocar o clima com a rota aberta.

Como funciona (`src/rotas/planejar.js`): o app pede o caminho mais rápido, confere quais bueiros
em risco ficam a até 35 m dele e, se houver, pede outro caminho mandando um quadrado em volta de
cada um como área a evitar. Depois confere o caminho novo e, se preciso, tenta de novo (até três
vezes).

Serviços usados, os dois abertos, sem chave e com dados do OpenStreetMap:

| Para quê | Serviço | Observação |
|---|---|---|
| Traçar a rota | [Valhalla](https://valhalla.github.io/valhalla/), no servidor público da FOSSGIS | Uso justo: um pedido por segundo. Aceita no máximo 100 vértices de áreas a evitar por pedido (cerca de 20 bueiros), medido em 06/10/2026. Sem garantia de disponibilidade. |
| Buscar endereço | [Photon](https://photon.komoot.io/), da komoot | Limitado à Grande São Paulo. Se estiver fora do ar, os lugares conhecidos continuam funcionando. |

Para trocar de servidor: `VITE_ROTAS_URL` e `VITE_ENDERECOS_URL` no `.env.local`. Só a partida e o
destino da rota (e o texto digitado na busca) são enviados a esses serviços. Para um app de
produção, o certo é ter um servidor de rotas próprio: o público é emprestado e tem esses limites.

## Cores e desenho

A regra é a dos grandes apps de mapa (Google Maps, Apple Maps, Waze): **o fundo é neutro e a cor
fica para o que significa algo**. No SIMA: cinza é a rua, azul é a água e a ação.

| Cor | Onde aparece | Onde não aparece |
|---|---|---|
| Cinza (grafite no noturno, concreto no claro) | Fundo das telas, cartões, vidro, terreno e ruas do mapa | — |
| Azul do projeto (`--route`, `--route-deep`) | Botão principal, item selecionado, foco, links, "onde estou", rota, chuva; no mapa, só a água | Fundos, ícones decorativos |
| As quatro cores de risco (`--r1` a `--r4`) | Tampas, anéis dos grupos, selos e textos de nível | Qualquer coisa que não seja risco |
| Verde suave | Parques e matas do mapa | Interface |

- Os tokens ficam em `src/estilos/base.css`. Para mudar a paleta, mexa só lá: as telas e o mapa
  leem dali (o mapa pelas cores `--map-*`, em `src/mapa/estiloMapa.js`).
- No mapa, a importância da via aparece pela largura, pela claridade e pelo zoom em que ela
  entra: de longe só expressas e avenidas; as ruas de bairro surgem ao aproximar. Córregos e rios
  ficam bem visíveis de propósito.
- O **cartão do bueiro** segue o padrão dos cartões de lugar desses apps: nome e situação, uma
  faixa com três números (água e lixo, medidos; chance de alagar, prevista) e os botões. O botão
  azul é a ação principal: "Desviar" quando o bueiro está em risco (alto, crítico ou transbordando)
  e "Ver detalhes" nos demais. No mapa, o botão azul redondo abre as rotas.
- A landing (`landing/`) continua com a paleta azulada anterior. Os nomes dos tokens são os mesmos,
  então dá para levar a nova paleta para lá copiando os blocos `.thm-dark` e `.thm-light`.

## Ligar no backend

Com o ml-service e o backend Java no ar:

```bash
cp .env.example .env.local
# no .env.local:
# VITE_API_URL=/api
npm run dev
```

O app passa a ler `GET /previsoes` (módulo `previsao` do backend) a cada 90 s.

**Por que `/api` e não `http://localhost:8080`:** em desenvolvimento o servidor do Vite repassa
`/api/...` para o backend (configurado em `vite.config.js`; o destino muda com `SIMA_BACKEND`).
Para o navegador é o mesmo endereço do app, então **não depende de CORS** liberado no backend.
Também serve para testar no celular: `npm run dev:rede` e abra, no celular na mesma rede Wi-Fi,
o endereço "Network" que o Vite mostra.

Fora do desenvolvimento (app publicado), aponte `VITE_API_URL` para o endereço do backend; aí sim
ele precisa de CORS liberado para a origem do app, ou de servir a pasta `dist/` ele mesmo.

### O contrato com o backend

Formato de cada item de `/previsoes`, conferido em 06/10/2026 (ver `normalizarPrevisao` em
`src/dados/modelo.js`):

`sensorId`, `latitude`, `longitude`, `vizinhanca`, `status`, `probabilidadeAlagamento`,
`nivelRisco`, `nivelRiscoModelo`, `janelaHoras`, `geradaEm`, `validaAte`, `horaReferencia`,
`medicaoTransbordando`, `ajusteSensorAplicado`, `semLeituraSensor`, `motivosAjuste`,
`chuvaRecente3hMm`, `chuvaPrevista3hMm`, `origem`, `modeloVersao`, `simulada`.

O que **falta no backend** para o app mostrar tudo:

| Campo (nome sugerido) | Para quê | Sem ele |
|---|---|---|
| `nivelAgua`, `porcentagemLixo`, `dataLeitura` | O lado "medido" do bueiro | O app mostra "Sem leitura" em todos os pontos |
| `statusSensor` (`ATIVO`, `INATIVO`, `MANUTENCAO`) | Dizer por que não há leitura | O app não distingue sensor inativo de sensor em manutenção |
| Fuso nas datas (ex.: `2026-10-06T13:18:18-03:00`) | Aparelhos fora do horário de São Paulo | O app assume São Paulo quando a data vem sem fuso |

A rota já responde sem login. A vizinhança dos sensores de exemplo é "Local de teste 0X"; rodando
o `docs/demo-sensores.sql` do backend ela vira `"R. Chico Pontes — Vila Maria / Vila Guilherme"`
e o app passa a mostrar endereço e bairro (e as previsões reagem à chuva, porque os sensores
ficam sobre pontos que o modelo conhece).

Para ver o app reagindo sem chuva de verdade, use o modo de demonstração do backend
(`POST /admin/demonstracao/iniciar`, ver `backend-core/docs/previsao-ia.md`). As previsões vêm com
`simulada: true` e o app mostra o aviso **"Simulação · chuva de teste ligada"**.

### O que acontece quando o backend não responde

O app **não** troca para os dados de demonstração: num app de risco, mostrar dados inventados
seria pior do que avisar. Ele mantém a última resposta boa (guardada no aparelho), mostra
"Sem conexão · dados das HH:MM" e tenta de novo sozinho. Como cada previsão tem validade
(`validaAte`), o que ficou velho aparece como **previsão desatualizada**, sem número.

## Estrutura

```
index.html                 aplica o tema antes do React (a tela não pisca)
src/
  main.jsx                 entrada: fontes, estilos, App
  App.jsx                  provedores e rotas (o mapa fica sempre montado por baixo)
  config.js                o que muda por ambiente (API, tiles, intervalo, serviços de rota)
  dados/
    niveis.js              escala de risco: Baixo, Médio, Alto, Crítico
    modelo.js              formato do "ponto", conversão do backend e textos da tela
    api.js                 GET /previsoes
    demo.js                demonstração: clima, sensibilidade de cada ponto, troca gradual
    pontosCapital.js       os 136 pontos da capital usados na demonstração
    bairros.js             resumo por bairro
    PontosContexto.jsx     guarda os pontos e atualiza sozinho (usePontos)
    modelo.test.js         testes das regras acima
    demo.test.js           testes da demonstração
  rotas/
    planejar.js            a regra: caminho mais rápido, bueiros no caminho, desvio e os textos
    geometria.js           contas de distância, traçado compactado e área a evitar
    servico.js             conversa com o serviço de rotas (Valhalla) e a busca de endereço (Photon)
    lugares.js             lugares conhecidos oferecidos como atalho
    RotaContexto.jsx       partida, chegada e resultado; refaz a rota quando o risco muda (useRotas)
    planejar.test.js       testes da regra, sem internet
  preferencias/
    PreferenciasContexto.jsx   tema, animações e modo de abertura do mapa (usePreferencias)
  mapa/
    estiloMapa.js          estilo do MapLibre montado com os tokens do tema
    MapaBase.jsx           o mapa, as tampas (marcadores) e o modo calor
    agrupar.js             junta bueiros próximos conforme o zoom (e agrupar.test.js)
  componentes/
    Tampa.jsx              a tampa que enche conforme o risco, e o selo de nível
    Icones.jsx             ícones de traço
    Tela.jsx               moldura das telas (animação de entrada e saída, título, foco, voltar, Esc)
    arrastar.js            folhas que acompanham o dedo (cartão do bueiro, barra de busca)
    ganchos.js             useVoltar, useTelaLarga, de onde a pessoa veio
  telas/
    Mapa.jsx               mapa, avisos, clima da demonstração, barra de busca, cartão do bueiro e modo rota
    Rotas.jsx              escolha da partida e do destino
    Bueiro.jsx             detalhe: medido × previsto
    Bairros.jsx            situação por bairro
    Busca.jsx              busca de bueiros e bairros
    Menu.jsx               atalhos, tema e ajustes
    EmConstrucao.jsx       telas das próximas etapas e a tela Sobre
  estilos/
    base.css               tokens dos dois temas e componentes (vidro, listas, botões)
    telas.css              estilos de cada tela
```

Endereços: `/` mapa · `/?ponto=ID` mapa com o cartão aberto · `/bueiro/ID` · `/bairros?b=Nome`
· `/busca` · `/rotas` escolher partida e destino · `/rota` mapa com a rota desenhada · `/menu` · `/sobre`. O endereço usa `#` (HashRouter) para o app funcionar em qualquer
hospedagem estática sem configurar o servidor.

## Decisões que valem lembrar

- **Medido separado de previsto.** Água, lixo e hora da leitura vêm do sensor; nível de risco e
  chance vêm da IA. Quando o sensor mede o bueiro cheio (`medicaoTransbordando`), a tela diz
  "Transbordando agora (medido)" e **não** mostra porcentagem.
- **O nível é a informação principal; a porcentagem é secundária.** As probabilidades do modelo
  são pequenas (ALTO começa perto de 1,2 %), então "3,4 % · Alto" precisa de contexto. Toda a
  exibição passa por `textoProbabilidade` em `modelo.js`. Como mostrar esse número é decisão em
  aberto do grupo (recomendação R3 do serviço de IA).
- **Risco por forma, cor e texto.** A tampa enche conforme o nível; nunca é só cor.
- **"Sem previsão" não é "sem risco".** Ponto sem estimativa aparece com a tampa tracejada.
- **Tema.** `.thm-dark` / `.thm-light` no `<html>`. O mapa lê as cores `--map-*` do CSS, então não
  existe uma segunda paleta para manter. A regra das cores está em "Cores e desenho", acima.
- **Tela larga.** A partir de 900 px as telas viram uma coluna à esquerda e o mapa continua
  visível — é o que permite usar o mesmo app como "mapa web" da landing.
- **Código do bueiro.** O banco só tem id, posição e vizinhança. O app monta o código com a sigla
  do bairro + id (`VG-05`). Se a vizinhança vier como `"Rua — Bairro"` (com travessão, como no
  `docs/demo-sensores.sql`), a primeira parte vira o endereço.

## Mapa

- Biblioteca: [MapLibre GL JS](https://maplibre.org/) 6.
- Tiles: [OpenFreeMap](https://openfreemap.org/) (gratuito, sem chave), esquema OpenMapTiles. Para
  trocar de servidor, use `VITE_MAPA_TILES` e `VITE_MAPA_GLIFOS`.
- Os créditos (OpenStreetMap, OpenMapTiles, OpenFreeMap) aparecem no canto do mapa e são
  obrigatórios.

## O que ainda não existe

| Tela | Depende de |
|---|---|
| Navegação passo a passo (voz, "vire à direita") | Decisão do grupo; o serviço de rotas já devolve as instruções em português |
| Rotas a pé ou de transporte | Fora do escopo: o grupo decidiu por rotas só de carro |
| Reportar problema | Domínio de Ocorrência no backend |
| Alertas | Alerta a partir de previsão no backend; notificações |
| Perfil e conta | Login (JWT) no backend |
| Aviso por região | Formato de `GET /previsoes/regioes` |
| Leitura do sensor com dados reais | `nivelAgua`, `porcentagemLixo`, `dataLeitura` e `statusSensor` em `/previsoes` |
| Gráfico de 12 h com dados reais | Histórico de leituras por sensor (hoje só na demonstração) |
| App nas lojas (APK) | Capacitor |

O mapa completo de construção está no projeto: `claude/app-mapa-de-construcao.md`.
