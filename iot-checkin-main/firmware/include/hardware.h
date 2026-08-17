#pragma once

#include <Arduino.h>
namespace hardware
{
   void begin();

   // Mở cửa: động cơ quay thuận DOOR_OPEN_MS, rồi tự quay ngược DOOR_CLOSE_MS để đóng
   void openDoor();
   void closeDoor();
   void setFreeAccessMode(bool enabled);
   void loop();

   // Phản hồi kết quả điểm danh
   // triggerSuccess: đèn xanh sáng 2s + bíp 1 tiếng ngắn 200ms
   // triggerFail:    đèn đỏ sáng 2s + bíp 2 tiếng ngắn (thử lại)
   void triggerSuccess();
   void triggerFail();

   // Đọc trạng thái IR: true = có vật cản (bị che), false = thông thoáng
   // IR1_OUT: mắt hồng ngoại ngoài cửa (phía hành lang)
   // IR2_IN:  mắt hồng ngoại trong cửa (phía trong phòng)
   bool readIR_Out();
   bool readIR_In();
}