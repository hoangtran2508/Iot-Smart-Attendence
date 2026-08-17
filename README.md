<div align="center">

# 🔐 IoT Check-in

### Hệ thống chấm công và kiểm soát ra vào thông minh

**Vân tay · Wi‑Fi · Mobile · Web Dashboard · MQTT · ESP8266**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=nextdotjs&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white)
![MQTT](https://img.shields.io/badge/MQTT-660066?logo=mqtt&logoColor=white)
![ESP8266](https://img.shields.io/badge/ESP8266-E7352C?logo=espressif&logoColor=white)
![Nx](https://img.shields.io/badge/Nx_Monorepo-143055?logo=nx&logoColor=white)

> Một nền tảng IoT kết hợp phần mềm và phần cứng để xác thực người dùng, ghi nhận lượt vào/ra, điều khiển cửa và quản lý dữ liệu chấm công theo thời gian thực.

</div>

---
## 🎬 Demo và báo cáo sản phẩm

- [▶️ Xem video demo](https://drive.google.com/file/d/1GuYFq73kAeKo30It8WPAVByuxD7V9Ca5/view?usp=sharing)
- [📄 Xem báo cáo sản phẩm](https://drive.google.com/drive/u/0/folders/1L_TIXFQXVCsKGIi82RkQjb1K3UFqNdh_)
## ✨ Điểm nổi bật

- 👆 **Check-in bằng vân tay** tại cổng ESP8266.
- 📱 **Check-in bằng Wi‑Fi** từ ứng dụng mobile trong mạng nội bộ.
- ↔️ Phân biệt chính xác chiều **đi vào / đi ra** bằng hai cảm biến hồng ngoại.
- 🚪 Tự động mở và đóng cửa qua động cơ cùng driver L298N.
- 🚨 Cảnh báo bằng LED và buzzer khi xác thực thất bại hoặc phát hiện bất thường.
- 🌐 Trao đổi thời gian thực giữa thiết bị và backend qua MQTT.
- 🛡️ Xác thực JWT, đăng nhập email/mật khẩu và Google Sign-In.
- 👥 Hai vai trò `admin` và `user` với quyền truy cập riêng.
- 🏢 Quản lý địa điểm, thành viên, thiết bị và mã tham gia.
- 🗓️ Cấu hình lịch làm việc và khung giờ ra vào tự do.
- 📊 Thống kê lượt check-in, trạng thái đúng giờ/đi muộn và xuất Excel.
- 📡 Theo dõi trạng thái thiết bị, địa chỉ IP và báo cáo MAC định kỳ.
- 💻 Một monorepo dùng chung kiểu dữ liệu giữa API, dashboard và mobile.

## 🧭 Kiến trúc hệ thống

```mermaid
flowchart LR
    USER["Người dùng"] --> MOBILE["Mobile App<br/>React Native"]
    ADMIN["Quản trị viên"] --> WEB["Web Dashboard<br/>Next.js"]

    MOBILE -->|"REST + JWT"| API["Backend API<br/>NestJS"]
    WEB -->|"REST + JWT"| API
    API --> DB[("PostgreSQL")]

    API <-->|"MQTT/TLS"| BROKER["MQTT Broker"]
    BROKER <-->|"Sự kiện & lệnh"| GATE["IoT Gate<br/>ESP8266"]

    MOBILE -->|"HTTP trong LAN"| GATE
    FP["Cảm biến vân tay"] --> GATE
    IR["2 cảm biến IR"] --> GATE
    GATE --> MOTOR["L298N + động cơ cửa"]
    GATE --> SIGNAL["LED + Buzzer"]
```

### Vai trò của từng thành phần

| Thành phần | Công nghệ | Nhiệm vụ |
|---|---|---|
| Backend API | NestJS, TypeORM | Xác thực, nghiệp vụ, REST API và kết nối MQTT |
| Dashboard | Next.js, React, Tailwind CSS | Quản trị người dùng, địa điểm, thiết bị và báo cáo |
| Mobile | React Native, Expo | Đăng nhập, tham gia địa điểm và check-in Wi‑Fi |
| Database | PostgreSQL | Lưu người dùng, thiết bị, vân tay và lịch sử check-in |
| IoT Gateway | ESP8266, Arduino, PlatformIO | Xử lý cảm biến, cửa, MQTT và HTTP nội bộ |
| Message broker | MQTT | Truyền sự kiện và lệnh giữa backend với thiết bị |
| Shared library | TypeScript | Chia sẻ request, response, theme và kiểu dữ liệu |

## 🔄 Luồng hoạt động

### Check-in bằng vân tay

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant IR as Cảm biến IR
    participant ESP as ESP8266
    participant FP as Cảm biến vân tay
    participant MQ as MQTT Broker
    participant API as Backend
    participant DB as PostgreSQL

    User->>IR: Đi tới cửa
    IR->>ESP: Xác định hướng IN/OUT
    User->>FP: Đặt ngón tay
    FP->>ESP: Finger ID hợp lệ
    ESP->>ESP: Mở cửa + LED xanh + buzzer
    User->>IR: Đi qua cảm biến phía đối diện
    ESP->>MQ: Gửi finger ID và hướng di chuyển
    MQ->>API: Chuyển sự kiện check-in
    API->>DB: Lưu thời gian và trạng thái
    ESP->>ESP: Đóng cửa
```

### Check-in bằng Wi‑Fi

1. Người dùng đứng đúng phía cửa để kích hoạt cảm biến IR.
2. Mobile gửi JWT, mã thiết bị và thông tin mạng tới HTTP server của ESP8266 trong LAN.
3. ESP8266 chuyển yêu cầu xác thực tới backend qua MQTT.
4. Backend kiểm tra token, device UUID và MAC đã đăng ký.
5. Nếu hợp lệ, backend gửi lệnh mở cửa; nếu bất thường, thiết bị phát cảnh báo.
6. Khi người dùng đi qua cảm biến đối diện, hệ thống ghi nhận lượt `in` hoặc `out`.

## 🗂️ Cấu trúc dự án

```text
iot-checkin-main/
├── apps/
│   ├── api/                   # NestJS REST API + MQTT service
│   ├── dashboard/             # Next.js web dashboard
│   └── mobile/                # React Native / Expo application
├── firmware/
│   ├── include/               # Cấu hình và header ESP8266
│   ├── src/                   # Firmware: Wi-Fi, MQTT, vân tay, cửa
│   └── platformio.ini         # Cấu hình PlatformIO cho NodeMCU v2
├── libs/
│   └── src/                   # Shared DTO, response, role và theme
├── nx.json                    # Nx workspace configuration
├── pnpm-workspace.yaml        # pnpm monorepo workspace
└── package.json
```

## 🧰 Công nghệ sử dụng

### Phần mềm

- Nx 22 và pnpm workspace
- TypeScript
- NestJS 11, TypeORM và PostgreSQL
- Next.js 16, React 19 và Tailwind CSS
- React Native 0.79, Expo 53 và React Navigation
- JWT, bcrypt và Google OAuth
- MQTT.js và ExcelJS

### Firmware

- NodeMCU v2 / ESP8266
- Arduino framework qua PlatformIO
- Adafruit Fingerprint Sensor Library
- PubSubClient
- ArduinoJson
- MQTT over TLS
- HTTP server trong mạng LAN

## ✅ Yêu cầu trước khi cài đặt

- Node.js 20 trở lên.
- pnpm 11.
- PostgreSQL.
- Một MQTT broker mà backend và ESP8266 đều truy cập được.
- PlatformIO Core hoặc PlatformIO extension cho Visual Studio Code.
- NodeMCU ESP8266 và các linh kiện phần cứng tương ứng.
- Android Studio/Xcode nếu chạy ứng dụng mobile native.

## 🚀 Khởi chạy nhanh

### 1. Cài dependencies

```bash
git clone https://github.com/YOUR_USERNAME/iot-checkin.git
cd iot-checkin
corepack enable
pnpm install
```

### 2. Tạo PostgreSQL database

Ví dụ:

```sql
CREATE DATABASE iot_checkin;
```

Trong môi trường phát triển, TypeORM đang bật `synchronize: true`, vì vậy các bảng sẽ được tạo tự động khi API kết nối database lần đầu.

> Không nên dùng `synchronize: true` trong production. Hãy chuyển sang migration trước khi triển khai thật.

### 3. Cấu hình backend

Tạo `apps/api/src/.env`:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/iot_checkin
JWT_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID

MQTT_URL=mqtts://YOUR_MQTT_HOST:8883
MQTT_USERNAME=YOUR_MQTT_USERNAME
MQTT_PASSWORD=YOUR_MQTT_PASSWORD
MQTT_TOPIC_CHECKIN=checkin/fingerprint
MQTT_TOPIC_COMMAND=command/fingerprint
MQTT_TOPIC_STATUS=device/status
MQTT_TOPIC_MACSCAN=mac/scan
```

Khởi chạy API:

```bash
pnpm nx serve api
```

Kiểm tra:

```text
http://localhost:3000/api/health
```

### 4. Cấu hình dashboard

Tạo `apps/dashboard/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
```

Khởi chạy dashboard:

```bash
pnpm nx dev dashboard
```

Mở địa chỉ được Next.js hiển thị trong terminal, thông thường là `http://localhost:4200` hoặc cổng trống gần nhất.

### 5. Cấu hình mobile

Tạo `apps/mobile/.env`:

```env
NEXT_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000/api
```

Khi chạy trên điện thoại thật, không dùng `localhost`; hãy dùng IP LAN của máy đang chạy API, ví dụ `http://192.168.1.10:3000/api`.

Chạy bản web phục vụ phát triển:

```bash
pnpm nx dev mobile
```

Để chạy native, chuẩn bị Android Studio hoặc Xcode theo hướng dẫn React Native/Expo rồi sử dụng target tương ứng của project mobile.

## 🔧 Cấu hình và nạp firmware

Firmware được cấu hình cho môi trường `esp8266`, board `nodemcuv2`.

### 1. Cấu hình thông tin kết nối

Mở `firmware/include/config.h` và thay các giá trị bằng cấu hình của bạn:

```cpp
static const char WIFI_SSID[] = "YOUR_WIFI_SSID";
static const char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";

static const char AP_SSID[] = "YOUR_GATE_AP_NAME";
static const char AP_PASSWORD[] = "YOUR_STRONG_AP_PASSWORD";

static const char MQTT_HOST[] = "YOUR_MQTT_HOST";
static const uint16_t MQTT_PORT = 8883;
static const char MQTT_USERNAME[] = "YOUR_MQTT_USERNAME";
static const char MQTT_PASSWORD[] = "YOUR_MQTT_PASSWORD";
```

Backend và firmware phải sử dụng cùng broker và cùng các MQTT topic.

### 2. Build và upload

```bash
cd firmware
pio run
pio run --target upload
pio device monitor
```

Serial Monitor sử dụng baud rate `115200`.

## 🔌 Sơ đồ chân ESP8266

| Thiết bị | Chân NodeMCU | Ghi chú |
|---|---|---|
| Fingerprint RX | `D6` | ESP8266 nhận dữ liệu từ cảm biến |
| Fingerprint TX | `D7` | ESP8266 gửi dữ liệu tới cảm biến |
| L298N IN1 | `D1` | Điều khiển chiều mở |
| L298N IN2 | `D0` | Điều khiển chiều đóng |
| Buzzer | `D8` | Báo trạng thái |
| IR ngoài cửa | `D2` | Phát hiện người chuẩn bị đi vào |
| IR trong cửa | `D4` | Phát hiện người chuẩn bị đi ra |
| LED xanh | `D5` | Xác thực thành công |
| LED đỏ | `D3` | Xác thực thất bại/cảnh báo |

> Kiểm tra kỹ mức điện áp, nguồn cấp và GND chung trước khi kết nối. Một số chân boot của ESP8266 có yêu cầu mức logic đặc biệt; đấu sai cảm biến hoặc buzzer có thể khiến board không khởi động.

## 📡 MQTT topics

| Topic | Chiều dữ liệu | Mục đích |
|---|---|---|
| `checkin/fingerprint` | Thiết bị → Backend | Check-in, enrollment, xóa vân tay và Wi‑Fi auth |
| `command/fingerprint` | Backend → Thiết bị | Lệnh mở cửa, enroll, xóa và free access |
| `device/status` | Thiết bị → Backend | Trạng thái online và IP của cổng |
| `mac/scan` | Thiết bị → Backend | Báo cáo MAC định kỳ |
| `checkin/key` | Thiết bị/ứng dụng | Dữ liệu hỗ trợ check-in nội bộ |

Các lệnh thiết bị đang hỗ trợ gồm:

```text
enroll
delete_finger
delete_all_fingers
open_door
fraud_alarm
set_free_access
```

## 🌐 API chính

Tất cả endpoint dùng prefix `/api`.

| Nhóm | Endpoint tiêu biểu | Chức năng |
|---|---|---|
| Health | `GET /health` | Kiểm tra API |
| Auth | `/auth/login`, `/auth/register`, `/auth/google`, `/auth/me` | Đăng nhập và hồ sơ hiện tại |
| Locations | `/locations`, `/locations/join` | Địa điểm, thành viên và mã tham gia |
| Check-ins | `/checkins`, `/checkins/wifi` | Ghi nhận và quản lý lượt vào/ra |
| Statistics | `/checkins-stats`, `/checkins-stats/export` | Thống kê và xuất Excel |
| Devices | `/locations/:id/devices` | Đăng ký, trạng thái và điều khiển cổng |
| Fingerprints | `/locations/:id/fingerprints` | Enrollment và trạng thái vân tay |
| Users | `/users` | Quản lý người dùng, vai trò và thiết bị cá nhân |

Các request được kiểm tra bằng `ValidationPipe`; route bảo vệ yêu cầu header:

```http
Authorization: Bearer YOUR_JWT_TOKEN
```

## 👤 Quyền người dùng

### User

- Đăng ký hoặc đăng nhập bằng email/mật khẩu hoặc Google.
- Tham gia địa điểm bằng mã gồm 6 ký tự.
- Xem địa điểm và lịch sử check-in của bản thân.
- Thực hiện check-in Wi‑Fi từ mobile.

### Admin

- Quản lý người dùng và phân quyền.
- Tạo, cập nhật hoặc xóa địa điểm.
- Thêm và điều khiển thiết bị IoT.
- Đăng ký hoặc xóa vân tay từ dashboard.
- Cấu hình lịch làm việc và free-access.
- Theo dõi thống kê và xuất báo cáo Excel.

## 🛡️ Bảo mật

Trước khi công khai hoặc triển khai repository:

- Không commit mật khẩu Wi‑Fi, AP, database hoặc MQTT.
- Thay toàn bộ credential đã từng xuất hiện trong lịch sử Git.
- Dùng `JWT_SECRET` dài, ngẫu nhiên và không dùng khóa mặc định.
- Chuyển cấu hình firmware nhạy cảm sang file local không được Git theo dõi.
- Bật xác minh chứng chỉ TLS cho MQTT trong production.
- Tắt `synchronize: true` và dùng database migration.
- Giới hạn CORS theo domain thật thay vì cho phép toàn bộ origin.
- Không ghi JWT, mật khẩu hoặc dữ liệu sinh trắc học vào log.
- Chỉ lưu ID mẫu vân tay; không đưa dữ liệu sinh trắc học thô lên MQTT.

Gợi ý tạo `firmware/include/config.example.h` chứa placeholder và thêm file thật vào `.gitignore`:

```gitignore
firmware/include/config.h
apps/api/src/.env
apps/api/src/.env.local
apps/dashboard/.env.local
apps/mobile/.env
```

## 🧪 Kiểm thử hệ thống

Một quy trình kiểm tra tối thiểu:

1. Xác nhận API trả về thành công tại `/api/health`.
2. Đăng ký tài khoản và đăng nhập để nhận JWT.
3. Tạo location, đăng ký IoT device và kiểm tra trạng thái online.
4. Yêu cầu enrollment từ dashboard, sau đó đặt ngón tay lên cảm biến.
5. Che IR ngoài, quét vân tay, đi qua IR trong và kiểm tra bản ghi `in`.
6. Che IR trong, xác thực, đi qua IR ngoài và kiểm tra bản ghi `out`.
7. Thử check-in Wi‑Fi từ mobile trong cùng mạng LAN.
8. Thử một token hoặc thiết bị không hợp lệ để kiểm tra cảnh báo gian lận.
9. Kiểm tra lịch free-access và thao tác xuất báo cáo Excel.

## 🛠️ Xử lý sự cố

| Hiện tượng | Cách kiểm tra |
|---|---|
| API không khởi động | Kiểm tra `DATABASE_URL`, PostgreSQL và cổng 3000 |
| Dashboard không gọi được API | Kiểm tra `NEXT_PUBLIC_API_URL` và CORS |
| Điện thoại không truy cập API | Dùng IP LAN thay cho `localhost`; kiểm tra firewall |
| ESP8266 không kết nối MQTT | Kiểm tra host, port 8883, credential và TLS |
| Thiết bị báo online nhưng không nhận lệnh | Kiểm tra topic và `client_id` đã đăng ký |
| Không tìm thấy cảm biến vân tay | Kiểm tra D6/D7, nguồn và baud 57600 |
| Hướng IN/OUT bị ngược | Kiểm tra vị trí IR ngoài D2 và IR trong D4 |
| Cửa quay sai chiều | Đảo dây động cơ hoặc điều chỉnh IN1/IN2 |
| ESP8266 không boot | Kiểm tra tải trên các chân boot D3, D4 và D8 |
| Google Sign-In lỗi | Bảo đảm client ID backend, dashboard và mobile phù hợp |

## 🛣️ Hướng phát triển

- Thêm migration và seed dữ liệu cho môi trường mới.
- Bổ sung Docker Compose cho PostgreSQL, API và MQTT broker.
- Viết unit test, integration test và kiểm thử firmware.
- Thêm OTA update cho ESP8266.
- Xác minh đầy đủ chứng chỉ MQTT TLS.
- Thêm refresh token, thu hồi phiên và audit log.
- Mã hóa cấu hình thiết bị và cấp credential riêng cho từng cổng.
- Hiển thị trạng thái real-time bằng WebSocket.
- Bổ sung ảnh chụp dashboard và sơ đồ đấu dây thực tế.

## 🤝 Đóng góp

Mọi issue và pull request đều được chào đón. Khi đóng góp, vui lòng không đưa credential thật, dữ liệu người dùng hoặc dữ liệu sinh trắc học vào commit.

---

<div align="center">

**Built with IoT, software engineering and a little hardware magic ✨**

Nếu dự án hữu ích, hãy để lại một ⭐!

</div>
