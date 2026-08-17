#include <Arduino.h>

#include "config.h"
#include "fingerprint_sensor.h"
#include "hardware.h"
#include "http_server.h"
#include "mqtt_client.h"
#include "wifi_manager.h"

enum AccessState
{
   STATE_IDLE,
   STATE_WAIT_AUTH_IN,
   STATE_WAIT_AUTH_OUT,
   STATE_WAIT_PASS_IN,
   STATE_WAIT_PASS_OUT
};

static AccessState accessState = STATE_IDLE;
static unsigned long stateStartMs = 0;
static const uint32_t AUTH_TIMEOUT_MS = 15000;
static const uint32_t PASS_TIMEOUT_MS = 15000;

enum PendingAuthType { AUTH_NONE, AUTH_FINGER, AUTH_WIFI };
static PendingAuthType pendingAuthType = AUTH_NONE;
static int pendingFingerId = 0;
static char pendingToken[256] = {0};
static char pendingDeviceUuid[64] = {0};
static char pendingClientMac[20] = {0};

static bool lastIR1 = false;
static bool lastIR2 = false;
static unsigned long ir1BlockedSinceMs = 0;
static unsigned long ir2BlockedSinceMs = 0;
static const uint32_t IR_DEBOUNCE_MS = 80;

static unsigned long lastScanMs = 0;
static const uint32_t SCAN_INTERVAL_MS = 15UL * 60UL * 1000UL;

static volatile bool enrollRequested = false;
static bool isEnrolling = false;

static void changeState(AccessState newState)
{
   accessState = newState;
   stateStartMs = millis();
   if (newState == STATE_IDLE) {
      pendingAuthType = AUTH_NONE;
   }
}

// Hàm này được gọi từ http_server.cpp
bool requestWifiAuth(const char* token, const char* deviceUuid, const char* clientMac)
{
   if (accessState == STATE_WAIT_AUTH_IN || accessState == STATE_WAIT_AUTH_OUT) {
      pendingAuthType = AUTH_WIFI;
      strncpy(pendingToken, token, sizeof(pendingToken) - 1);
      strncpy(pendingDeviceUuid, deviceUuid, sizeof(pendingDeviceUuid) - 1);
      strncpy(pendingClientMac, clientMac, sizeof(pendingClientMac) - 1);
      
      // Gửi request lên Backend để xin mở cửa
      mqtt_client::publishWifiAuthRequest(token, deviceUuid, clientMac);

      if (accessState == STATE_WAIT_AUTH_IN) {
         Serial.println("[IR] WiFi auth requested for IN. Cho cua mo va di qua IR2...");
         changeState(STATE_WAIT_PASS_IN);
      } else {
         Serial.println("[IR] WiFi auth requested for OUT. Cho cua mo va di qua IR1...");
         changeState(STATE_WAIT_PASS_OUT);
      }
      return true;
   }
   Serial.println("[IR] Tu choi WiFi auth vi chua che mat hong ngoai!");
   return false;
}

static void onDoorCommand(const char* command)
{
   if (strcmp(command, "open_door") == 0)
   {
      Serial.println("[Main] Server cho phep vao -> Mo cua!");
      hardware::openDoor();
      hardware::triggerSuccess();
   }
   else if (strcmp(command, "fraud_alarm") == 0)
   {
      Serial.println("[Main] Server phat hien GIAN LAN -> Hu coi!");
      hardware::triggerFail();
      changeState(STATE_IDLE);
   }
   else if (strcmp(command, "free_open_door") == 0)
   {
      Serial.println("[Main] Gio tu do -> Mo cua khong can xac thuc!");
      hardware::openDoor();
      hardware::triggerSuccess();
   }
}

static void onFreeAccessCommand(bool enabled)
{
   hardware::setFreeAccessMode(enabled);
}

static void onEnrollCommand()
{
   enrollRequested = true;
}

static void onDeleteFinger(uint8_t fingerId)
{
   bool ok = fingerprint_sensor::deleteFingerprint(fingerId);
   mqtt_client::publishDeleteResult(fingerId, ok);
}

static void onDeleteAllFingers()
{
   bool ok = fingerprint_sensor::deleteAllFingerprints();
   mqtt_client::publishDeleteAllResult(ok);
}

void setup()
{
   Serial.begin(115200);
   delay(200);
   Serial.println("=== ESP2 Cua Phong - Khoi dong ===");

   hardware::begin();
   wifi_manager::begin();
   mqtt_client::begin();
   mqtt_client::setEnrollCallback(onEnrollCommand);
   mqtt_client::setDoorCommandCallback(onDoorCommand);
   mqtt_client::setFreeAccessCallback(onFreeAccessCommand);
   mqtt_client::setDeleteFingerCallback(onDeleteFinger);
   mqtt_client::setDeleteAllFingersCallback(onDeleteAllFingers);

   // Start HTTP server for serving check-in key to mobile apps
   http_server::begin();

   if (fingerprint_sensor::begin())
   {
      Serial.println("[FP] Cam bien van tay san sang.");
   }
   else
   {
      Serial.println("[FP] KHONG tim thay cam bien van tay!");
   }
}

void loop()
{
   yield();

   wifi_manager::loop();
   mqtt_client::loop();
   hardware::loop();
   http_server::loop();

   // ---------------------------------------------------------
   // 1. ENROLL VÂN TAY
   // ---------------------------------------------------------
   if (enrollRequested)
   {
      enrollRequested = false;
      isEnrolling     = true;
      Serial.println("\n>>> KICH HOAT CHE DO THEM VAN TAY MOI <<<");

      int newId = fingerprint_sensor::enrollNewFingerprint();
      if (newId > 0)
      {
         mqtt_client::publishEnrollSuccess(newId);
         hardware::triggerSuccess();
      }
      else
      {
         char payload[80];
         snprintf(payload, sizeof(payload),
                  "{\"event\":\"enroll_failed\",\"client_id\":\"%s\"}",
                  mqtt_client::getClientId());
         mqtt_client::publishPayload(payload);
         hardware::triggerFail();
      }
      isEnrolling = false;
      changeState(STATE_IDLE);
   }

   if (isEnrolling) return;

   // ---------------------------------------------------------
   // 2. ĐỌC CẢM BIẾN HỒNG NGOẠI
   // ---------------------------------------------------------
   unsigned long now = millis();
   bool ir1Now = hardware::readIR_Out();
   bool ir2Now = hardware::readIR_In();

   if (ir1Now != lastIR1) { lastIR1 = ir1Now; ir1BlockedSinceMs = now; }
   if (ir2Now != lastIR2) { lastIR2 = ir2Now; ir2BlockedSinceMs = now; }

   bool ir1Stable = ir1Now && (now - ir1BlockedSinceMs >= IR_DEBOUNCE_MS);
   bool ir2Stable = ir2Now && (now - ir2BlockedSinceMs >= IR_DEBOUNCE_MS);

   // ---------------------------------------------------------
   // 3. STATE MACHINE IR & AUTH
   // ---------------------------------------------------------
   switch (accessState)
   {
      case STATE_IDLE:
      {
         if (ir1Stable && !ir2Stable) {
            Serial.println("[IR] Da che IR1 (Ngoai). Cho xac thuc de vao IN...");
            changeState(STATE_WAIT_AUTH_IN);
         } else if (ir2Stable && !ir1Stable) {
            Serial.println("[IR] Da che IR2 (Trong). Cho xac thuc de ra OUT...");
            changeState(STATE_WAIT_AUTH_OUT);
         }
         
         // Quét bỏ các lần quẹt vân tay khi chưa che IR
         if (fingerprint_sensor::poll() != 0) {
            Serial.println("[FP] Tu choi van tay vi chua che hong ngoai!");
            hardware::triggerFail();
         }
         break;
      }
      case STATE_WAIT_AUTH_IN:
      case STATE_WAIT_AUTH_OUT:
      {
         if (now - stateStartMs > AUTH_TIMEOUT_MS) {
            Serial.println("[IR] Het thoi gian xac thuc -> Huy.");
            changeState(STATE_IDLE);
            break;
         }

         int fingerId = fingerprint_sensor::poll();
         if (fingerId > 0) {
            Serial.printf("[FP] Van tay hop le ID #%d. Mo cua cho di qua...\n", fingerId);
            pendingAuthType = AUTH_FINGER;
            pendingFingerId = fingerId;
            hardware::openDoor();
            hardware::triggerSuccess();
            
            if (accessState == STATE_WAIT_AUTH_IN) {
               changeState(STATE_WAIT_PASS_IN);
            } else {
               changeState(STATE_WAIT_PASS_OUT);
            }
         } else if (fingerId < 0) {
            Serial.println("[FP] Van tay KHONG hop le.");
            hardware::triggerFail();
            mqtt_client::publishUnknownFingerprint();
         }
         // Lưu ý: WiFi auth được gọi trực tiếp từ http_server qua requestWifiAuth()
         break;
      }
      case STATE_WAIT_PASS_IN:
      {
         if (now - stateStartMs > PASS_TIMEOUT_MS) {
            Serial.println("[IR] Het thoi gian di qua cua (IN) -> Huy.");
            changeState(STATE_IDLE);
            break;
         }
         if (ir2Stable) {
            Serial.println("[IR] Da di qua IR2. Gui ban tin MQTT Check-in IN va DONG CUA ngay!");
            if (pendingAuthType == AUTH_FINGER) {
               mqtt_client::publishFingerprint(pendingFingerId, "in");
            } else if (pendingAuthType == AUTH_WIFI) {
               mqtt_client::publishWifiCheckin(pendingToken, pendingDeviceUuid, pendingClientMac, "in");
            }
            hardware::closeDoor();
            changeState(STATE_IDLE);
         }
         break;
      }
      case STATE_WAIT_PASS_OUT:
      {
         if (now - stateStartMs > PASS_TIMEOUT_MS) {
            Serial.println("[IR] Het thoi gian di qua cua (OUT) -> Huy.");
            changeState(STATE_IDLE);
            break;
         }
         if (ir1Stable) {
            Serial.println("[IR] Da di qua IR1. Gui ban tin MQTT Check-in OUT va DONG CUA ngay!");
            if (pendingAuthType == AUTH_FINGER) {
               mqtt_client::publishFingerprint(pendingFingerId, "out");
            } else if (pendingAuthType == AUTH_WIFI) {
               mqtt_client::publishWifiCheckin(pendingToken, pendingDeviceUuid, pendingClientMac, "out");
            }
            hardware::closeDoor();
            changeState(STATE_IDLE);
         }
         break;
      }
   }

   // ---------------------------------------------------------
   // 4. QUÉT NỀN MAC 15 PHÚT
   // ---------------------------------------------------------
   if (now - lastScanMs >= SCAN_INTERVAL_MS)
   {
      lastScanMs = now;
      Serial.println("[Scan] Dang gui bao cao MAC dinh ky 15 phut...");
      mqtt_client::scanAndPublishStations();
   }
}