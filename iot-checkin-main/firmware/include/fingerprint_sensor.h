#pragma once

#include <Arduino.h>

namespace fingerprint_sensor
{
   bool begin();
   int poll();

   // Blocking enrollment: tự tìm slot trống, chụp 2 lần, lưu vào Flash.
   // Trả về fingerId mới nếu thành công, -1 nếu lỗi.
   int enrollNewFingerprint();

   // Xoá vân tay theo ID. Trả về true nếu thành công, false nếu lỗi.
   bool deleteFingerprint(uint8_t id);

   // Xoá toàn bộ vân tay trong Flash. Trả về true nếu thành công.
   bool deleteAllFingerprints();
}