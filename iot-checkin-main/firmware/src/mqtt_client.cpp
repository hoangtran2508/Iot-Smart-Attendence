#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
extern "C"
{
#include "user_interface.h" // wifi_softap_get_station_info, station_info
}

#include "config.h"
#include "mqtt_client.h"

#if MQTT_USE_TLS
#include <WiFiClientSecureBearSSL.h>
static BearSSL::WiFiClientSecure mqttNet;
#else
static WiFiClient mqttNet;
#endif

static PubSubClient mqttClient(mqttNet);
static unsigned long lastReconnectMs = 0;

// Client ID được tạo từ MAC address: "esp_AABBCCDDEEFF"
static char mqttClientId[20] = {0};

// Callback khi nhận lệnh enroll từ backend
static void (*enrollCallback)() = nullptr;
// Callback khi nhận lệnh điều khiển cửa từ Server
static void (*doorCommandCallback)(const char *command) = nullptr;
static void (*freeAccessCallback)(bool enabled) = nullptr;
// Callback khi nhận lệnh xóa vân tay theo ID
static void (*deleteFingerCallback)(uint8_t fingerId) = nullptr;
// Callback khi nhận lệnh xóa toàn bộ vân tay
static void (*deleteAllFingersCallback)() = nullptr;

static void buildClientId()
{
   uint8_t mac[6];
   WiFi.macAddress(mac);
   snprintf(mqttClientId, sizeof(mqttClientId),
            "esp_%02X%02X%02X%02X%02X%02X",
            mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
   Serial.print("MQTT Client ID: ");
   Serial.println(mqttClientId);
}

// Xử lý message nhận từ MQTT broker
static void onMessage(char *topic, byte *payload, unsigned int length)
{
   // Parse JSON payload
   StaticJsonDocument<256> doc;
   DeserializationError err = deserializeJson(doc, payload, length);
   if (err)
   {
      Serial.print("JSON parse error: ");
      Serial.println(err.c_str());
      return;
   }

   // ── Handle command topic ──
   if (strcmp(topic, MQTT_TOPIC_COMMAND) != 0)
   {
      return;
   }

   const char *command = doc["command"];
   const char *clientId = doc["client_id"];

   if (!command || !clientId)
   {
      Serial.println("Invalid command payload");
      return;
   }

   // Kiểm tra client_id có khớp với thiết bị này không
   if (strcmp(clientId, mqttClientId) != 0)
   {
      return; // Lệnh không dành cho thiết bị này
   }

   if (strcmp(command, "enroll") == 0)
   {
      Serial.println(">>> NHAN LENH ENROLL TU BACKEND <<<");
      if (enrollCallback)
      {
         enrollCallback();
      }
   }
   else if (strcmp(command, "delete_finger") == 0)
   {
      int fingerId = doc["finger_id"] | -1;
      if (fingerId < 1 || fingerId > 127)
      {
         Serial.println("[MQTT] delete_finger: finger_id khong hop le (1-127)");
         return;
      }
      Serial.print(">>> NHAN LENH XOA VAN TAY ID #");
      Serial.println(fingerId);
      if (deleteFingerCallback)
      {
         deleteFingerCallback((uint8_t)fingerId);
      }
   }
   else if (strcmp(command, "delete_all_fingers") == 0)
   {
      Serial.println(">>> NHAN LENH XOA TOAN BO VAN TAY <<<");
      if (deleteAllFingersCallback)
      {
         deleteAllFingersCallback();
      }
   }
   else if (strcmp(command, "open_door") == 0 ||
            strcmp(command, "fraud_alarm") == 0 ||
            strcmp(command, "free_open_door") == 0)
   {
      Serial.print(">>> NHAN LENH DIEU KHIEN CUA: ");
      Serial.println(command);
      if (doorCommandCallback)
      {
         doorCommandCallback(command);
      }
   }
   else if (strcmp(command, "set_free_access") == 0)
   {
      Serial.println(">>> NHAN LENH CAI DAT FREE ACCESS <<<");
      if (freeAccessCallback)
      {
         bool enabled = false;
         if (doc.containsKey("enabled"))
         {
            enabled = doc["enabled"].as<bool>();
         }
         freeAccessCallback(enabled);
      }
   }
   else
   {
      Serial.print("Unknown command: ");
      Serial.println(command);
   }
}

static bool connectIfNeeded()
{
   if (mqttClient.connected())
   {
      return true;
   }

   unsigned long now = millis();
   if (now - lastReconnectMs < MQTT_RECONNECT_MS)
   {
      return false;
   }

   lastReconnectMs = now;
   bool connected = false;
   if (MQTT_USERNAME[0] != '\0')
   {
      connected = mqttClient.connect(mqttClientId, MQTT_USERNAME, MQTT_PASSWORD);
   }
   else
   {
      connected = mqttClient.connect(mqttClientId);
   }

   if (connected)
   {
      Serial.println("MQTT connected successfully");

      // Subscribe topic command để nhận lệnh từ backend
      mqttClient.subscribe(MQTT_TOPIC_COMMAND);
      Serial.print("Subscribed to command topic: ");
      Serial.println(MQTT_TOPIC_COMMAND);

      // Publish device status (IP address) so backend knows our LAN address
      String statusPayload = String("{\"device_id\":\"") + String(mqttClientId) +
                             "\",\"ip\":\"" + WiFi.localIP().toString() +
                             "\",\"event\":\"online\"}";
      mqttClient.publish(MQTT_TOPIC_STATUS, statusPayload.c_str());
      Serial.print("Published status, IP: ");
      Serial.println(WiFi.localIP());
   }
   else
   {
      Serial.print("MQTT connection failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" will retry...");
   }

   return connected;
}

bool mqtt_client::publishPayload(const char *payload)
{
   if (!connectIfNeeded())
   {
      return false;
   }

   return mqttClient.publish(MQTT_TOPIC_CHECKIN, payload);
}

void mqtt_client::begin()
{
   buildClientId();
#if MQTT_USE_TLS
   if (MQTT_TLS_INSECURE)
   {
      mqttNet.setInsecure(); // Simplify TLS setup; replace with CA cert for production.
   }
#endif
   mqttClient.setServer(MQTT_HOST, MQTT_PORT);
   mqttClient.setBufferSize(MQTT_BUFFER_SIZE); // tránh mất gói JSON lớn
   mqttClient.setKeepAlive(MQTT_KEEPALIVE_SEC);
   mqttClient.setSocketTimeout(15);
   mqttClient.setCallback(onMessage);
}

void mqtt_client::loop()
{
   if (connectIfNeeded())
   {
      mqttClient.loop();

      // Gửi status heartbeat định kỳ mỗi 60 giây để backend cập nhật lastSeenAt
      static unsigned long lastStatusPublishMs = 0;
      unsigned long now = millis();
      if (lastStatusPublishMs == 0 || now - lastStatusPublishMs >= 60000)
      {
         lastStatusPublishMs = now;
         String statusPayload = String("{\"device_id\":\"") + String(mqttClientId) +
                                "\",\"ip\":\"" + WiFi.localIP().toString() +
                                "\",\"event\":\"ping\"}";
         mqttClient.publish(MQTT_TOPIC_STATUS, statusPayload.c_str());
         Serial.println("[MQTT] Published periodic status heartbeat (ping)");
      }
   }
}

bool mqtt_client::publishFingerprint(int fingerId, const char *direction)
{
   char payload[160];
   snprintf(payload, sizeof(payload),
            "{\"event\":\"matched\",\"client_id\":\"%s\",\"finger_id\":%d,\"matched\":true,\"direction\":\"%s\"}",
            mqttClientId, fingerId, direction ? direction : "unknown");
   return mqttClient.publish(MQTT_TOPIC_CHECKIN, payload);
}

bool mqtt_client::publishUnknownFingerprint()
{
   char payload[128];
   snprintf(payload, sizeof(payload),
            "{\"event\":\"matched\",\"client_id\":\"%s\",\"finger_id\":0,\"matched\":false}",
            mqttClientId);
   return mqttClient.publish(MQTT_TOPIC_CHECKIN, payload);
}

bool mqtt_client::publishEnrollSuccess(int fingerId)
{
   char payload[128];
   snprintf(payload, sizeof(payload),
            "{\"event\":\"enrolled\",\"client_id\":\"%s\",\"finger_id\":%d}",
            mqttClientId, fingerId);
   return mqttClient.publish(MQTT_TOPIC_CHECKIN, payload);
}

bool mqtt_client::isConnected()
{
   return mqttClient.connected();
}

const char *mqtt_client::getClientId()
{
   return mqttClientId;
}

void mqtt_client::setEnrollCallback(void (*cb)())
{
   enrollCallback = cb;
}

void mqtt_client::setDoorCommandCallback(void (*cb)(const char *command))
{
   doorCommandCallback = cb;
}

void mqtt_client::setDeleteFingerCallback(void (*cb)(uint8_t fingerId))
{
   deleteFingerCallback = cb;
}

void mqtt_client::setDeleteAllFingersCallback(void (*cb)())
{
   deleteAllFingersCallback = cb;
}

void mqtt_client::setFreeAccessCallback(void (*cb)(bool enabled))
{
   freeAccessCallback = cb;
}

bool mqtt_client::publishWifiCheckin(const char* token, const char* deviceUuid, const char* clientMac, const char* direction)
{
   char payload[768];
   snprintf(payload, sizeof(payload),
            "{\"event\":\"wifi_checkin\",\"client_id\":\"%s\",\"token\":\"%s\",\"device_uuid\":\"%s\",\"client_mac\":\"%s\",\"direction\":\"%s\"}",
            mqttClientId, token ? token : "", deviceUuid ? deviceUuid : "", clientMac ? clientMac : "", direction ? direction : "unknown");
   return mqttClient.publish(MQTT_TOPIC_CHECKIN, payload);
}

bool mqtt_client::publishWifiAuthRequest(const char* token, const char* deviceUuid, const char* clientMac)
{
   char payload[768];
   snprintf(payload, sizeof(payload),
            "{\"event\":\"wifi_auth_request\",\"client_id\":\"%s\",\"token\":\"%s\",\"device_uuid\":\"%s\",\"client_mac\":\"%s\"}",
            mqttClientId, token ? token : "", deviceUuid ? deviceUuid : "", clientMac ? clientMac : "");
   return mqttClient.publish(MQTT_TOPIC_CHECKIN, payload);
}

// Gửi key + client_id xuống App qua topic "app/key"
// App subscribe topic này, nhận key rồi tự gửi {key,mac,rssi,id} lên Server
// client_id giúp App biết ESP2 nào đang yêu cầu (hệ thống nhiều phòng)
bool mqtt_client::publishToAppTopic(const char *payload)
{
   if (!connectIfNeeded())
   {
      return false;
   }
   return mqttClient.publish("app/key", payload);
}

// =============================================================
// QUÉT MAC CÁC THIẾT BỊ ĐANG KẾT NỐI VÀO SOFTAP
// Build JSON: {"event":"scan","client_id":"...","macs":["AA:BB:...", ...]}
// Gửi lên topic config (MQTT_TOPIC_MACSCAN) để Server xử lý bám đuôi
// =============================================================
void mqtt_client::scanAndPublishStations()
{
   if (!mqttClient.connected())
   {
      return;
   }

   // Lấy danh sách station đang kết nối vào SoftAP
   struct station_info *stationList = wifi_softap_get_station_info();
   struct station_info *node = stationList;

   // Build JSON thủ công để tiết kiệm RAM (không dùng ArduinoJson cho mảng lớn)
   // Format: {"event":"scan","client_id":"esp_XXXX","macs":["AA:BB:CC:DD:EE:FF",...]}
   char payload[512];
   int offset = 0;
   offset += snprintf(payload + offset, sizeof(payload) - offset,
                      "{\"event\":\"scan\",\"client_id\":\"%s\",\"macs\":[",
                      mqttClientId);

   bool first = true;
   while (node != nullptr && offset < (int)sizeof(payload) - 30)
   {
      uint8_t *mac = node->bssid;
      if (!first)
      {
         offset += snprintf(payload + offset, sizeof(payload) - offset, ",");
      }
      offset += snprintf(payload + offset, sizeof(payload) - offset,
                         "\"%02X:%02X:%02X:%02X:%02X:%02X\"",
                         mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
      first = false;
      node = STAILQ_NEXT(node, next);
   }

   wifi_softap_free_station_info(); // Giải phóng bộ nhớ ngay sau khi dùng xong

   snprintf(payload + offset, sizeof(payload) - offset, "]}");
   mqttClient.publish(MQTT_TOPIC_MACSCAN, payload);
   Serial.println("[Scan] Da gui bao cao MAC stations.");
}

// =============================================================
// GỬI BÁO CÁO MẢNG QUÉT NỀN ĐỊA CHỈ MAC CHU KỲ 15 PHÚT
// =============================================================
bool mqtt_client::publishScanReport(const char *payload)
{
   if (!mqttClient.connected())
   {
      return false;
   }
   return mqttClient.publish(MQTT_TOPIC_MACSCAN, payload);
}

// Báo kết quả xóa vân tay theo ID lên backend
bool mqtt_client::publishDeleteResult(uint8_t fingerId, bool success)
{
   char payload[128];
   snprintf(payload, sizeof(payload),
            "{\"event\":\"deleted\",\"client_id\":\"%s\",\"finger_id\":%d,\"success\":%s}",
            mqttClientId, fingerId, success ? "true" : "false");
   return mqttClient.publish(MQTT_TOPIC_CHECKIN, payload);
}

// Báo kết quả xóa toàn bộ vân tay lên backend
bool mqtt_client::publishDeleteAllResult(bool success)
{
   char payload[96];
   snprintf(payload, sizeof(payload),
            "{\"event\":\"deleted_all\",\"client_id\":\"%s\",\"success\":%s}",
            mqttClientId, success ? "true" : "false");
   return mqttClient.publish(MQTT_TOPIC_CHECKIN, payload);
}