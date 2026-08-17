#include <Arduino.h>
#include "config.h"
#include "hardware.h"

// ── Motor state machine ────────────────────────────────────────
// IDLE     : động cơ dừng
// OPENING  : đang quay thuận (mở cửa), chờ DOOR_OPEN_MS
// CLOSING  : đang quay ngược (đóng cửa), chờ DOOR_CLOSE_MS
enum MotorState { MOTOR_IDLE, MOTOR_OPENING, MOTOR_HOLDING, MOTOR_CLOSING };
static MotorState motorState     = MOTOR_IDLE;
static unsigned long motorStartMs = 0;
static bool isFreeAccessMode = false;

static void motorForward()  // quay thuận → mở cửa
{
   digitalWrite(PIN_MOTOR_IN1, LOW);
   analogWrite(PIN_MOTOR_IN2, MOTOR_SPEED);
}
static void motorReverse()  // quay ngược → đóng cửa
{
   analogWrite(PIN_MOTOR_IN1, MOTOR_SPEED);                         
   digitalWrite(PIN_MOTOR_IN2, LOW);
}
static void motorStop()
{
   digitalWrite(PIN_MOTOR_IN1, LOW);
   digitalWrite(PIN_MOTOR_IN2, LOW);
}

// ── Buzzer (non-blocking pattern) ─────────────────────────────
struct BuzzStep { uint16_t onMs; uint16_t offMs; };
static BuzzStep buzzerPattern[4];
static uint8_t  buzzerStep        = 0;
static bool     buzzerOn          = false;
static unsigned long buzzerStepMs = 0;
static bool isBuzzerActive        = false;

static void startBuzzerPattern(const BuzzStep* p, uint8_t count)
{
   for (uint8_t i = 0; i < count && i < 3; i++) buzzerPattern[i] = p[i];
   buzzerPattern[count] = {0, 0};
   buzzerStep    = 0;
   buzzerOn      = true;
   buzzerStepMs  = millis();
   isBuzzerActive = true;
   digitalWrite(PIN_BUZZER, HIGH);
}

// ── LED (non-blocking) ─────────────────────────────────────────
static unsigned long ledStartMs   = 0;
static uint32_t      ledDurationMs = 0;
static uint8_t       ledPin        = 0;
static bool isLedActive            = false;

static void startLed(uint8_t pin, uint32_t durationMs)
{
   if (isLedActive) digitalWrite(ledPin, LOW);
   ledPin        = pin;
   ledDurationMs = durationMs;
   ledStartMs    = millis();
   isLedActive   = true;
   digitalWrite(pin, HIGH);
}

// ──────────────────────────────────────────────────────────────
void hardware::begin()
{
   pinMode(PIN_MOTOR_IN1, OUTPUT); digitalWrite(PIN_MOTOR_IN1, LOW);
   pinMode(PIN_MOTOR_IN2, OUTPUT); digitalWrite(PIN_MOTOR_IN2, LOW);
   pinMode(PIN_BUZZER,    OUTPUT); digitalWrite(PIN_BUZZER,    LOW);
   pinMode(PIN_LED_GREEN, OUTPUT); digitalWrite(PIN_LED_GREEN, LOW);
   pinMode(PIN_LED_RED,   OUTPUT); digitalWrite(PIN_LED_RED,   LOW);
   pinMode(PIN_IR1_OUT,   INPUT);
   pinMode(PIN_IR2_IN,    INPUT);
   Serial.println("[Hardware] Khoi tao xong: Motor L298N, Buzzer, LED, IR.");
}

void hardware::openDoor()
{
   if (motorState == MOTOR_OPENING || motorState == MOTOR_HOLDING) return;
   motorForward();
   motorState   = MOTOR_OPENING;
   motorStartMs = millis();
   Serial.println("[Hardware] -> Dong co QUAY MO cua!");
}

void hardware::closeDoor()
{
   if (isFreeAccessMode) return;
   if (motorState == MOTOR_IDLE || motorState == MOTOR_CLOSING) return;
   
   motorReverse();
   motorState   = MOTOR_CLOSING;
   motorStartMs = millis();
   Serial.println("[Hardware] -> Dong co QUAY DONG cua (ep buoc)!");
}

void hardware::setFreeAccessMode(bool enabled)
{
   isFreeAccessMode = enabled;
   if (enabled) {
      Serial.println("[Hardware] Free Access Mode ENABLED -> Opening door.");
      openDoor();
   } else {
      Serial.println("[Hardware] Free Access Mode DISABLED -> Will close door.");
      if (motorState == MOTOR_HOLDING) {
         // Force closing after short delay
         motorStartMs = millis() - DOOR_HOLD_MS;
      }
   }
}

// Chấm công THÀNH CÔNG: đèn xanh 2s + bíp 1 tiếng 200ms
void hardware::triggerSuccess()
{
   startLed(PIN_LED_GREEN, 2000);
   static const BuzzStep p[] = {{200, 0}};
   startBuzzerPattern(p, 1);
   Serial.println("[Hardware] -> Thanh cong: den xanh + bip 1 tieng.");
}

// Chấm công THẤT BẠI: đèn đỏ 2s + bíp 2 tiếng ngắn
void hardware::triggerFail()
{
   startLed(PIN_LED_RED, 2000);
   static const BuzzStep p[] = {{150, 150}, {150, 0}};
   startBuzzerPattern(p, 2);
   Serial.println("[Hardware] -> That bai: den do + bip 2 tieng.");
}

// ──────────────────────────────────────────────────────────────
void hardware::loop()
{
   unsigned long now = millis();

   // Motor state machine
   switch (motorState)
   {
      case MOTOR_OPENING:
         if (now - motorStartMs >= DOOR_OPEN_MS)
         {
            motorStop();
            motorState   = MOTOR_HOLDING;
            motorStartMs = millis();
            Serial.println("[Hardware] -> Mo xong, giu cho nguoi di qua.");
         }
         break;

      case MOTOR_HOLDING:
         if (!isFreeAccessMode && now - motorStartMs >= DOOR_HOLD_MS)
         {
            motorReverse();
            motorState   = MOTOR_CLOSING;
            motorStartMs = millis();
            Serial.println("[Hardware] -> Bat dau DONG cua.");
         }
         break;

      case MOTOR_CLOSING:
         if (now - motorStartMs >= DOOR_CLOSE_MS)
         {
            motorStop();
            motorState = MOTOR_IDLE;
            Serial.println("[Hardware] -> Dong cua xong.");
         }
         break;

      case MOTOR_IDLE:
      default:
         break;
   }

   // Buzzer state machine
   if (isBuzzerActive)
   {
      BuzzStep& step = buzzerPattern[buzzerStep];
      if (step.onMs == 0 && step.offMs == 0)
      {
         digitalWrite(PIN_BUZZER, LOW);
         isBuzzerActive = false;
      }
      else if (buzzerOn)
      {
         if (now - buzzerStepMs >= step.onMs)
         {
            digitalWrite(PIN_BUZZER, LOW);
            buzzerOn     = false;
            buzzerStepMs = now;
         }
      }
      else
      {
         if (now - buzzerStepMs >= step.offMs)
         {
            buzzerStep++;
            BuzzStep& next = buzzerPattern[buzzerStep];
            if (next.onMs == 0 && next.offMs == 0)
            {
               isBuzzerActive = false;
            }
            else
            {
               digitalWrite(PIN_BUZZER, HIGH);
               buzzerOn     = true;
               buzzerStepMs = now;
            }
         }
      }
   }

   // LED tự tắt
   if (isLedActive && (now - ledStartMs >= ledDurationMs))
   {
      digitalWrite(ledPin, LOW);
      isLedActive = false;
   }
}

bool hardware::readIR_Out() { return digitalRead(PIN_IR1_OUT) == LOW; }
bool hardware::readIR_In()  { return digitalRead(PIN_IR2_IN)  == LOW; }