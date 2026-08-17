#pragma once

#include <Arduino.h>

//static const char WIFI_SSID[] = "UET-Wifi-T2 2.4Ghz";
//static const char WIFI_PASSWORD[] = "";

static const char WIFI_SSID[] = "Phuong Linh";
static const char WIFI_PASSWORD[] = "31052014";

static const char AP_SSID[] = "Checkin_Gate_2";
static const char AP_PASSWORD[] = "12345678";

static const int WIFI_OUTPUT_POWER_DBM = 10;

static const char MQTT_HOST[] = "7b89c37bbae04e05a38ad56bb01f159f.s1.eu.hivemq.cloud";
static const uint16_t MQTT_PORT = 8883;
static const char MQTT_USERNAME[] = "cabylock";
static const char MQTT_PASSWORD[] = "Cabylock1234";
static const char MQTT_TOPIC_CHECKIN[] = "checkin/fingerprint";
static const char MQTT_TOPIC_COMMAND[] = "command/fingerprint";
static const char MQTT_TOPIC_KEY[] = "checkin/key";
static const char MQTT_TOPIC_STATUS[] = "device/status";
static const char MQTT_TOPIC_MACSCAN[] = "mac/scan";
static const uint16_t MQTT_KEEPALIVE_SEC = 30;

// HTTP server for serving check-in key to mobile apps on LAN
static const uint16_t HTTP_SERVER_PORT = 80;
static const uint32_t MQTT_RECONNECT_MS = 5000;

#define MQTT_USE_TLS 1
#define MQTT_TLS_INSECURE 1

static const uint8_t FP_RX_PIN = D6;
static const uint8_t FP_TX_PIN = D7;
static const uint32_t FP_BAUD = 57600;
static const uint32_t FP_SCAN_INTERVAL_MS = 100;

static const uint32_t ENROLL_TIMEOUT_MS = 10000;

// L298N: IN1=D1 quay thuận (mở), IN2=D0 quay ngược (đóng)
static const uint8_t PIN_MOTOR_IN1  = D1;
static const uint8_t PIN_MOTOR_IN2  = D0;
static const uint32_t DOOR_OPEN_MS  = 200; // thời gian quay mở (ms)
static const uint32_t DOOR_HOLD_MS  = 5000; // giữ mở cho người đi qua (ms)
static const uint32_t DOOR_CLOSE_MS = 200; // thời gian quay đóng (ms)
static const uint32_t MOTOR_SPEED   = 800;

static const uint8_t PIN_BUZZER  = D8;
static const uint8_t PIN_IR1_OUT = D2;
static const uint8_t PIN_IR2_IN  = D4;

static const uint8_t PIN_LED_GREEN = D5;
static const uint8_t PIN_LED_RED   = D3;

static const uint16_t MQTT_BUFFER_SIZE = 512;