#include <Adafruit_Fingerprint.h>
#include <SoftwareSerial.h>

#include "config.h"
#include "fingerprint_sensor.h"
#include "mqtt_client.h"

static SoftwareSerial fingerSerial(FP_RX_PIN, FP_TX_PIN);
static Adafruit_Fingerprint finger(&fingerSerial);

static unsigned long lastScanMs = 0;
static bool waitingForRelease = false;


bool fingerprint_sensor::begin()
{
   finger.begin(FP_BAUD);
   return finger.verifyPassword();
}

static bool readyForScan()
{
   if (!waitingForRelease)
   {
      return true;
   }

   uint8_t p = finger.getImage();
   if (p == FINGERPRINT_NOFINGER)
   {
      waitingForRelease = false;
      return true;
   }

   return false;
}

int fingerprint_sensor::poll()
{
   if (!readyForScan())
   {
      return 0;
   }

   unsigned long now = millis();
   if (now - lastScanMs < FP_SCAN_INTERVAL_MS)
   {
      return 0;
   }

   lastScanMs = now;
   uint8_t p = finger.getImage();
   if (p != FINGERPRINT_OK)
   {
      return 0;
   }

   p = finger.image2Tz();
   if (p != FINGERPRINT_OK)
   {
      waitingForRelease = true;
      return 0;
   }

   p = finger.fingerFastSearch();
   waitingForRelease = true;
   if (p == FINGERPRINT_OK)
   {
      return finger.fingerID;
   }
   if (p == FINGERPRINT_NOTFOUND)
   {
      return -1;
   }

   return 0;
}

// =============================================================
// HÀM TỰ ĐỘNG THÊM VÂN TAY (ENROLL) KHÔNG CẦN CẮM MÁY TÍNH
// Tự tìm slot trống → chụp 2 lần → so khớp → lưu Flash
// =============================================================
int fingerprint_sensor::enrollNewFingerprint()
{
   uint8_t p;
   uint8_t newId = 0; // 0 = chưa tìm được slot trống

   // Tìm slot trống đầu tiên (1-127)
   for (int i = 1; i <= 127; i++)
   {
      yield();
      if (finger.loadModel(i) != FINGERPRINT_OK)
      {
         newId = i;
         break;
      }
   }

   if (newId == 0)
   {
      Serial.println("[Enroll] Bo nho day, khong con slot trong (1-127)!");
      return -1;
   }

   Serial.print("[Enroll] Dang ky vao ID #");
   Serial.println(newId);
   Serial.println("[Enroll] Dat ngon tay vao cam bien...");

   // --- Chờ đặt tay lần 1 (timeout 10s) ---
   p = 0xFF;
   unsigned long timeout = millis();
   while (p != FINGERPRINT_OK)
   {
      yield();
      p = finger.getImage();
      if (p == FINGERPRINT_OK)
      {
         Serial.println("[Enroll] Da chup anh lan 1!");
      }
      if (millis() - timeout > ENROLL_TIMEOUT_MS)
      {
         Serial.println("[Enroll] Huy do qua thoi gian cho.");
         return -1;
      }
      yield();
   }

   p = finger.image2Tz(1);
   if (p != FINGERPRINT_OK)
   {
      Serial.println("[Enroll] Anh mo, huy.");
      return -1;
   }

   // --- Kiểm tra vân tay đã tồn tại chưa (search ngay sau lần 1) ---
   // fingerFastSearch dùng CharBuffer1 — phải search trước createModel
   // vì createModel sẽ ghi đè buffer
   p = finger.fingerFastSearch();
   if (p == FINGERPRINT_OK)
   {
      Serial.print("[Enroll] Van tay DA TON TAI o ID #");
      Serial.print(finger.fingerID);
      Serial.println(" — Tra ve ID cu de dong bo lai voi DB!");
      return finger.fingerID;
   }

   // --- Chờ nhấc tay ra ---
   Serial.println("[Enroll] Nhac ngon tay ra...");
   delay(2000);
   p = 0;
   while (p != FINGERPRINT_NOFINGER)
   {
      yield();
      mqtt_client::loop();
      p = finger.getImage();
   }

   // --- Chờ đặt tay lần 2 (timeout 10s) ---
   Serial.println("[Enroll] Dat lai ngon tay do vao lan 2...");
   p = 0xFF;
   timeout = millis();
   while (p != FINGERPRINT_OK)
   {
      yield();
      mqtt_client::loop();
      p = finger.getImage();
      if (p == FINGERPRINT_OK)
      {
         Serial.println("[Enroll] Da chup anh lan 2!");
      }
      if (millis() - timeout > ENROLL_TIMEOUT_MS)
      {
         Serial.println("[Enroll] Huy do qua thoi gian cho lan 2.");
         return -1;
      }
      yield();
   }

   p = finger.image2Tz(2);
   if (p != FINGERPRINT_OK)
   {
      Serial.println("[Enroll] Khong phan tich duoc anh lan 2.");
      return -1;
   }

   // --- So khớp 2 ảnh ---
   p = finger.createModel();
   if (p != FINGERPRINT_OK)
   {
      Serial.println("[Enroll] Van tay 2 lan khong khop nhau!");
      return -1;
   }

   Serial.println("[Enroll] Van tay trung khop!");

   // --- Lưu vào Flash ---
   p = finger.storeModel(newId);
   if (p == FINGERPRINT_OK)
   {
      Serial.print("[Enroll] THANH CONG! Da luu vao ID #");
      Serial.println(newId);
      return newId;
   }
   else
   {
      Serial.println("[Enroll] Loi luu Flash!");
      return -1;
   }
}
// =============================================================
// XOÁ VÂN TAY THEO ID
// =============================================================
bool fingerprint_sensor::deleteFingerprint(uint8_t id)
{
   uint8_t p = finger.deleteModel(id);
   if (p == FINGERPRINT_OK)
   {
      Serial.print("[FP] Da xoa van tay ID #");
      Serial.println(id);
      return true;
   }
   Serial.print("[FP] Loi xoa van tay ID #");
   Serial.print(id);
   Serial.print(", ma loi: ");
   Serial.println(p);
   return false;
}

// =============================================================
// XOÁ TOÀN BỘ VÂN TAY
// =============================================================
bool fingerprint_sensor::deleteAllFingerprints()
{
   uint8_t p = finger.emptyDatabase();
   if (p == FINGERPRINT_OK)
   {
      Serial.println("[FP] Da xoa TOAN BO van tay!");
      return true;
   }
   Serial.print("[FP] Loi xoa toan bo, ma loi: ");
   Serial.println(p);
   return false;
}