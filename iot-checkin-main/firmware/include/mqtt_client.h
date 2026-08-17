   #pragma once

   #include <Arduino.h>

   namespace mqtt_client
   {
      void begin();
      void loop();
      bool publishFingerprint(int fingerId, const char* direction = "unknown");
      bool publishUnknownFingerprint();
      bool publishEnrollSuccess(int fingerId);
      bool isConnected();
      const char *getClientId();
      void setEnrollCallback(void (*cb)());

      // Callback nhận lệnh điều khiển cửa từ Server
      // open_door, fraud_alarm, free_open_door
      void setDoorCommandCallback(void (*cb)(const char* command));
      void setFreeAccessCallback(void (*cb)(bool enabled));

      bool publishWifiCheckin(const char* token, const char* deviceUuid, const char* clientMac, const char* direction);
      bool publishWifiAuthRequest(const char* token, const char* deviceUuid, const char* clientMac);

      // Gửi key xuống App qua topic "app/key" khi IR2 trigger
      bool publishToAppTopic(const char* payload);

      // GỬI BÁO CÁO MẢNG QUÉT NỀN ĐỊA CHỈ MAC CHU KỲ 15 PHÚT
      bool publishScanReport(const char* payload);
      bool publishPayload(const char* payload);

      // QUÉT MAC CÁC THIẾT BỊ ĐANG KẾT NỐI VÀO SOFTAP, build JSON rồi publish
      void scanAndPublishStations();

      // Đăng ký callback xử lý lệnh xóa vân tay theo ID
   void setDeleteFingerCallback(void (*cb)(uint8_t fingerId));

   // Đăng ký callback xử lý lệnh xóa toàn bộ vân tay
   void setDeleteAllFingersCallback(void (*cb)());

   // Báo kết quả xóa vân tay theo ID lên backend
   bool publishDeleteResult(uint8_t fingerId, bool success);

   // Báo kết quả xóa toàn bộ vân tay lên backend
   bool publishDeleteAllResult(bool success);
   }