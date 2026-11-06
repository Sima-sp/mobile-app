// Firmware do protótipo do SIMA (ESP32 + sensor de distância por ultrassom).
// Mede a distância do sensor até a água e envia ao servidor do sensor (iot/servidor-sensor)
// pelo Wi-Fi, a cada 2 s, só quando a medida é válida.
// Código do grupo do IoT, como usado na feira de 07/10/2026. Antes de gravar a placa,
// preencha WIFI_PASS e confira SERVER_URL (ver iot/README.md).

#include <WiFi.h>
#include <HTTPClient.h>

// ===== PINOS =====
#define TRIG_PIN 22
#define ECHO_PIN 23
#define LED_PIN 18

// ===== CONFIGURAÇÕES =====
const char* WIFI_SSID = "iPhone de Raphael";
const char* WIFI_PASS = "SUA_SENHA";
const char* SERVER_URL = "http://172.20.10.2:3000/api/leitura";
const unsigned long INTERVALO_ENVIO = 2000; // envia a cada 2 s
const unsigned long TEMPO_MAX_WIFI = 15000;

float distancia;
unsigned long ultimoEnvio = 0;
unsigned long tempoAnterior = 0;
bool estadoLED = false;
int intervaloLED = 500;

// ==============================
// WI-FI
// ==============================
bool conectarWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Conectando ao Wi-Fi");
  unsigned long inicio = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - inicio > TEMPO_MAX_WIFI) {
      Serial.println(" falhou");
      return false;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println(" ok");
  Serial.print("IP do ESP: ");
  Serial.println(WiFi.localIP());
  return true;
}

// ==============================
// ENVIO
// ==============================
int enviar(float dist) {
  if (WiFi.status() != WL_CONNECTED) {
    if (!conectarWiFi()) return -1;
  }
  String json = "{\"device\":\"bueiro_01\"";
  if (dist >= 0) {
    json += ",\"distancia\":" + String(dist, 1);
  }
  json += "}";

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(json);
  http.end();
  Serial.print("Envio -> codigo HTTP: ");
  Serial.println(code);
  return code;
}

// ==============================
// DISTÂNCIA
// ==============================
float medirDistancia() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duracao = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duracao == 0) return -1;
  float d = duracao * 0.0343 / 2.0;
  if (d < 2 || d > 450) return -1;
  return d;
}

// ==============================
// SETUP
// ==============================
void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  digitalWrite(LED_PIN, LOW);
  Serial.println();
  Serial.println("=== SIMA - iniciado ===");
  conectarWiFi();
}

// ==============================
// LOOP
// ==============================
void loop() {
  distancia = medirDistancia();
  if (distancia < 0) {
    Serial.println("Sem leitura");
  } else {
    Serial.print("Distancia: ");
    Serial.print(distancia, 1);
    Serial.println(" cm");

    if (distancia <= 25) intervaloLED = 100;
    else if (distancia <= 45) intervaloLED = 300;
    else intervaloLED = 700;
  }

  // LED pisca conforme a distância
  unsigned long agora = millis();
  if (distancia >= 0 && agora - tempoAnterior >= (unsigned long)intervaloLED) {
    tempoAnterior = agora;
    estadoLED = !estadoLED;
    digitalWrite(LED_PIN, estadoLED);
  }

  // Envia ao servidor (só se houver leitura válida)
  if (agora - ultimoEnvio >= INTERVALO_ENVIO) {
    ultimoEnvio = agora;
    if (distancia >= 0) enviar(distancia);
  }
  delay(50);
}
