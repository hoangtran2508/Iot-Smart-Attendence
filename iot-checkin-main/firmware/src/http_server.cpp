#include <ESP8266WebServer.h>
#include <ArduinoJson.h>

#include "config.h"
#include "http_server.h"
#include "mqtt_client.h"

extern bool requestWifiAuth(const char* token, const char* deviceUuid, const char* clientMac);

static ESP8266WebServer server(HTTP_SERVER_PORT);

static void handleCheckin()
{
   // Set CORS headers so mobile apps on LAN can access
   server.sendHeader("Access-Control-Allow-Origin", "*");
   server.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
   server.sendHeader("Access-Control-Allow-Headers", "Content-Type");

   if (server.method() == HTTP_OPTIONS) {
      server.send(204);
      return;
   }

   if (!server.hasArg("plain")) {
      server.send(400, "application/json", "{\"error\":\"Missing body\"}");
      return;
   }

   StaticJsonDocument<512> doc;
   DeserializationError error = deserializeJson(doc, server.arg("plain"));

   if (error) {
      server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
      return;
   }

   const char* token = doc["token"];
   const char* deviceUuid = doc["deviceUuid"];
   const char* clientMacRaw = doc["clientMac"];

   if (!token || !deviceUuid) {
      server.send(400, "application/json", "{\"error\":\"Missing token or deviceUuid\"}");
      return;
   }

   // Read client MAC address from body if provided
   String clientMac = clientMacRaw ? String(clientMacRaw) : "";

   // Call main state machine to request auth
   if (requestWifiAuth(token, deviceUuid, clientMac.c_str())) {
      server.send(200, "application/json", "{\"success\":true}");
   } else {
      server.send(403, "application/json", "{\"error\":\"Please block IR sensor first\"}");
   }
}

static void handleCheckinGet()
{
   if (!server.hasArg("token") || !server.hasArg("deviceUuid") || !server.hasArg("redirect")) {
      server.send(400, "text/plain", "Missing token, deviceUuid, or redirect URL");
      return;
   }

   String token = server.arg("token");
   String deviceUuid = server.arg("deviceUuid");
   String redirectUrl = server.arg("redirect");
   String clientMac = server.hasArg("clientMac") ? server.arg("clientMac") : "";

   if (requestWifiAuth(token.c_str(), deviceUuid.c_str(), clientMac.c_str())) {
      // Success: redirect back to PWA with success status
      String fullRedirect = redirectUrl + "?status=success";
      server.sendHeader("Location", fullRedirect);
      server.send(302, "text/plain", "Redirecting...");
   } else {
      // Failed (e.g., IR not blocked): redirect with error status
      String fullRedirect = redirectUrl + "?status=error&message=Please+block+IR+sensor+first";
      server.sendHeader("Location", fullRedirect);
      server.send(302, "text/plain", "Redirecting...");
   }
}

static void handleNotFound()
{
   server.send(404, "application/json", "{\"error\":\"Not found\"}");
}

void http_server::begin()
{
   server.on("/checkin", HTTP_POST, handleCheckin);
   server.on("/checkin", HTTP_OPTIONS, handleCheckin);
   server.on("/checkin", HTTP_GET, handleCheckinGet);
   server.onNotFound(handleNotFound);
   server.begin();
   Serial.print("HTTP server started on port ");
   Serial.println(HTTP_SERVER_PORT);
}

void http_server::loop()
{
   server.handleClient();
}
