# SIMA · IoT (servidor do sensor e firmware)

Código do protótipo de hardware do SIMA, feito pelo grupo do IoT e usado na feira de 07/10/2026.
Está aqui para ficar guardado junto do app; o painel que mostra a leitura é do app
(`sensor.html`, código em `src/sensor/`).

```
ESP32 + sensor ──Wi-Fi──▶ servidor do sensor (Node, porta 3000) ◀── painel do sensor (sima-sensor.html)
   firmware/                 servidor-sensor/                         src/sensor/ do app
```

## Firmware (`firmware/sima_sensor/sima_sensor.ino`)

- ESP32 com sensor de distância por ultrassom: `TRIG` no pino 22, `ECHO` no 23, LED no 18.
- Mede cerca de 20 vezes por segundo (um laço a cada 50 ms) e **envia uma leitura a cada 2 s**:
  `POST /api/leitura` com `{"device":"bueiro_01","distancia":32.4}` (cm, do sensor até a água).
- **Só envia leitura válida**: sem eco, ou fora de 2 a 450 cm, não envia nada. O sensor alcança
  2000 cm, mas este código ainda corta em 450 cm (na bancada isso não aparece).
- O LED pisca mais rápido conforme a água chega perto: até 25 cm, até 45 cm e acima disso.
- **Wi-Fi e endereço do servidor ficam escritos no código.** A senha está como `SUA_SENHA`
  (não vai para o repositório): preencha antes de gravar e não envie de volta com a senha.
  `SERVER_URL` aponta para `172.20.10.2`, o endereço que o hotspot do iPhone costuma dar ao
  primeiro aparelho que entra.

Gravar: abra a pasta `firmware/sima_sensor` na Arduino IDE (com o pacote de placas do ESP32),
preencha `WIFI_PASS`, escolha a placa e a porta e envie. O monitor serial (115200) deve mostrar
`Envio -> codigo HTTP: 200` a cada 2 s.

## Servidor do sensor (`servidor-sensor/`)

Node + Express, porta 3000, aceita pedidos de qualquer endereço (CORS aberto).

| Rota | O que faz |
|---|---|
| `POST /api/leitura` | Recebe a leitura do ESP32, classifica e guarda **só a última, em memória** |
| `GET /api/leitura` | A última leitura (ou `null` se ainda não chegou nenhuma) |
| `GET /api/limites` | `{ "zonaCega": 15, "critico": 20, "alerta": 30, "atencao": 45 }` |
| `GET /api/stream` | A leitura em tempo real (Server-Sent Events) |
| `/` | Arquivos da pasta `public/` |

Rodar:

```
cd iot/servidor-sensor
npm install
node server.js
```

O painel do SIMA: na raiz do repositório, `npm run painel` gera `dist-painel/sima-sensor.html`;
copie para `iot/servidor-sensor/public/` e abra `http://localhost:3000/sima-sensor.html`. Ele
conecta sozinho, sem internet.

## Na bancada

1. Hotspot do iPhone ligado, com "Maximizar Compatibilidade" (o ESP32 só vê Wi-Fi de 2,4 GHz).
2. O notebook do servidor entra no hotspot **primeiro** e precisa ficar com `172.20.10.2`.
3. `node server.js` no notebook.
4. Liga a placa. `http://localhost:3000/api/leitura` passa a mostrar a distância.

## Diferenças que valem lembrar

- **Limites.** O servidor classifica com crítico 20, alerta 30, atenção 45 cm (zona cega 15). O
  painel do SIMA usa crítico 30, alto 45, médio 60 cm, porque o sensor só mede a partir de 20 cm
  (informado em 07/10); o painel não usa os limites do servidor para dar o nível, só avisa que
  são diferentes. O LED do firmware usa 25 e 45 cm.
- **Leitura impossível.** O servidor aceita `distancia: 0` e classifica como Crítico. O firmware
  não manda isso hoje; o painel mostra "Leitura inválida".
- **Nível do servidor.** O campo `nivel` do servidor vai de 0 (Normal) a 3 (Crítico); o do app vai
  de 1 (Baixo) a 4 (Crítico). O painel não usa o do servidor.
- **Nada fica guardado e nada vai ao backend.** Só a última leitura, em memória; qualquer aparelho
  da rede pode enviar leitura. Levar a leitura ao backend em Java é o passo seguinte.
- O pacote de onde este código veio não trazia o painel original do grupo (`public/index.html`
  do servidor); se ele existir, pode entrar em `servidor-sensor/public/`.
