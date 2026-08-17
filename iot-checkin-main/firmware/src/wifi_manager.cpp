#include <ESP8266WiFi.h>

#include "config.h"
#include "wifi_manager.h"

static unsigned long lastReconnectMs = 0;
static const uint32_t WIFI_RECONNECT_MS = 5000;
static wl_status_t lastStatus = WL_IDLE_STATUS;

static const char *statusToString(wl_status_t status)
{
   switch (status)
   {
   case WL_NO_SHIELD:
      return "NO_SHIELD";
   case WL_IDLE_STATUS:
      return "IDLE";
   case WL_NO_SSID_AVAIL:
      return "NO_SSID";
   case WL_SCAN_COMPLETED:
      return "SCAN_DONE";
   case WL_CONNECTED:
      return "CONNECTED";
   case WL_CONNECT_FAILED:
      return "CONNECT_FAILED";
   case WL_CONNECTION_LOST:
      return "CONNECTION_LOST";
   case WL_DISCONNECTED:
      return "DISCONNECTED";
   default:
      return "UNKNOWN";
   }
}

void wifi_manager::begin()
{
   WiFi.mode(WIFI_AP_STA);
   WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
   Serial.print("WiFi connecting to ");
   Serial.println(WIFI_SSID);

   WiFi.softAP(AP_SSID, AP_PASSWORD);

   WiFi.setOutputPower(WIFI_OUTPUT_POWER_DBM);
   Serial.printf("[Wi-Fi] SoftAP '%s' is ready!\n", AP_SSID);

   lastStatus = WiFi.status();
}

void wifi_manager::loop()
{
   wl_status_t status = WiFi.status();
   if (status != lastStatus)
   {
      lastStatus = status;
      if (status == WL_CONNECTED)
      {
         Serial.print("WiFi connected, IP: ");
         Serial.println(WiFi.localIP());
      }
      else
      {
         Serial.print("WiFi not connected, status: ");
         Serial.println(statusToString(status));
      }
   }

   if (status == WL_CONNECTED)
   {
      return;
   }

   unsigned long now = millis();
   if (now - lastReconnectMs < WIFI_RECONNECT_MS)
   {
      return;
   }

   lastReconnectMs = now;
   WiFi.disconnect();
   WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

bool wifi_manager::isConnected()
{
   return WiFi.status() == WL_CONNECTED;
}
