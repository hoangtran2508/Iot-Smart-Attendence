import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'crypto';
import * as mqtt from 'mqtt';
import { LessThan, Repository } from 'typeorm';
import { CheckIn } from '../../entities/checkin.entity';
import { JwtService } from '@nestjs/jwt';
import { UserDevice } from '../../entities/user-device.entity';
import { Device } from '../../entities/device.entity';
import { Fingerprint } from '../../entities/fingerprint.entity';
import { Location } from '../../entities/location.entity';
import { PendingEnrollment } from '../../entities/pending-enrollment.entity';
import { StationScanReport } from '../../entities/station-scan-report.entity';

@Injectable()
export class MqttService implements OnModuleInit {
  private readonly logger = new Logger(MqttService.name);
  private client!: mqtt.MqttClient;
  private freeAccessState: Map<string, boolean> = new Map();

  constructor(
    private configService: ConfigService,
    @InjectRepository(Device)
    private devicesRepo: Repository<Device>,
    @InjectRepository(PendingEnrollment)
    private pendingRepo: Repository<PendingEnrollment>,
    @InjectRepository(Fingerprint)
    private fingerprintsRepo: Repository<Fingerprint>,
    @InjectRepository(CheckIn)
    private checkinsRepo: Repository<CheckIn>,
    @InjectRepository(StationScanReport)
    private stationScanReportsRepo: Repository<StationScanReport>,
    @InjectRepository(Location)
    private locationsRepo: Repository<Location>,
    @InjectRepository(UserDevice)
    private userDevicesRepo: Repository<UserDevice>,
    private jwtService: JwtService,
  ) { }

  onModuleInit() {
    const url = this.configService.get<string>('MQTT_URL');
    const username = this.configService.get<string>('MQTT_USERNAME');
    const password = this.configService.get<string>('MQTT_PASSWORD');
    const topic = this.configService.get<string>('MQTT_TOPIC_CHECKIN');

    if (!url) {
      this.logger.warn('MQTT_URL is not defined. MQTT Service disabled.');
      return;
    }

    this.client = mqtt.connect(url, {
      username,
      password,
      clientId: `api-backend-${Math.random().toString(16).slice(2, 8)}`,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker at ${url}`);

      // Subscribe to fingerprint check-in topic
      if (topic) {
        this.client.subscribe(topic, (err) => {
          if (!err) {
            this.logger.log(`Subscribed to topic: ${topic}`);
          }
        });
      }

      // Subscribe to device status topic (ESP reports IP on connect)
      const statusTopic = this.configService.get<string>('MQTT_TOPIC_STATUS') || 'device/status';
      this.client.subscribe(statusTopic, (err) => {
        if (!err) {
          this.logger.log(`Subscribed to status topic: ${statusTopic}`);
        }
      });

      // Subscribe to MAC scan reports topic
      const macScanTopic = this.configService.get<string>('MQTT_TOPIC_MACSCAN') || 'mac/scan';
      this.client.subscribe(macScanTopic, (err) => {
        if (!err) {
          this.logger.log(`Subscribed to MAC scan topic: ${macScanTopic}`);
        }
      });

      // Start free access schedule checker
      this.checkFreeAccessSchedules();
      setInterval(() => this.checkFreeAccessSchedules(), 60000);
    });

    this.client.on('message', async (receivedTopic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        const statusTopic = this.configService.get<string>('MQTT_TOPIC_STATUS') || 'device/status';
        const macScanTopic = this.configService.get<string>('MQTT_TOPIC_MACSCAN') || 'mac/scan';

        if (receivedTopic === statusTopic) {
          await this.handleDeviceStatus(payload);
        } else if (receivedTopic === macScanTopic) {
          await this.handleMacScan(payload);
        } else {
          await this.handleMessage(payload);
        }
      } catch (err) {
        this.logger.error('Error processing MQTT message', err);
      }
    });
  }

  private async handleMessage(payload: any) {
    const { event, client_id, finger_id, matched, direction } = payload;

    if (!client_id) {
      this.logger.warn(`Invalid payload received: ${JSON.stringify(payload)}`);
      return;
    }

    // 1. Xác định thiết bị
    const device = await this.devicesRepo.findOne({ where: { clientId: client_id } });
    if (!device) {
      this.logger.warn(`Received message from unknown device: ${client_id}`);
      return;
    }

    // Update lastSeenAt on any valid MQTT message
    device.lastSeenAt = new Date();
    await this.devicesRepo.save(device);

    if (event === 'enrolled') {
      await this.handleEnrollment(device, finger_id);
    } else if (event === 'enroll_failed') {
      await this.handleEnrollmentFailed(device, payload.error);
    } else if (event === 'matched' && matched === true) {
      await this.handleCheckin(device, finger_id, direction);
    } else if (event === 'deleted') {
      if (payload.success === true) {
        await this.fingerprintsRepo.delete({ deviceId: device.id, fingerId: finger_id });
        this.logger.log(`Deleted finger_id ${finger_id} mapping on device ${device.clientId} from DB`);
      }
    } else if (event === 'deleted_all') {
      if (payload.success === true) {
        await this.fingerprintsRepo.delete({ deviceId: device.id });
        this.logger.log(`Deleted all finger mappings on device ${device.clientId} from DB`);
      }
    } else if (event === 'wifi_auth_request') {
      await this.handleWifiAuthRequestMQTT(device, payload);
    } else if (event === 'wifi_checkin') {
      await this.handleWifiCheckinMQTT(device, payload);
    } else {
      this.logger.debug(`Ignored event: ${event} for finger_id: ${finger_id}`);
    }
  }

  /**
   * Handle device status messages (ESP reports its LAN IP on connect).
   */
  private async handleDeviceStatus(payload: any) {
    const { device_id, ip, event } = payload;
    if (!device_id || !ip) return;

    const device = await this.devicesRepo.findOne({ where: { clientId: device_id } });
    if (!device) {
      this.logger.warn(`Status from unknown device: ${device_id}`);
      return;
    }

    device.ipAddress = ip;
    device.lastSeenAt = new Date();
    await this.devicesRepo.save(device);
    this.logger.log(`Device ${device_id} reported IP: ${ip} (event: ${event})`);
  }

  private async handleMacScan(payload: any) {
    const { client_id, macs } = payload;
    if (!client_id || !Array.isArray(macs)) {
      this.logger.warn(`Invalid MAC scan payload: ${JSON.stringify(payload)}`);
      return;
    }

    const device = await this.devicesRepo.findOne({ where: { clientId: client_id } });
    if (!device) {
      this.logger.warn(`MAC scan from unknown device: ${client_id}`);
      return;
    }

    const report = this.stationScanReportsRepo.create({
      deviceId: device.id,
      macs,
    });
    await this.stationScanReportsRepo.save(report);

    device.lastSeenAt = new Date();
    await this.devicesRepo.save(device);
    this.logger.log(`Saved MAC scan report for device ${client_id} with ${macs.length} station(s)`);
  }

  private async handleEnrollment(device: Device, fingerId: number) {
    this.logger.log(`Device ${device.clientId} enrolled finger_id: ${fingerId}`);

    // Xóa các pending enrollments đã hết hạn trước để dọn dẹp
    await this.pendingRepo.delete({ expiresAt: LessThan(new Date()) });

    // Tìm pending enrollment hợp lệ gần nhất tại location này
    const pending = await this.pendingRepo.findOne({
      where: { locationId: device.locationId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    if (!pending) {
      this.logger.warn(`No pending enrollment found for location ${device.locationId}`);
      return;
    }

    // Xoá mapping cũ nếu fingerprint ID này đã tồn tại trên thiết bị (trường hợp ESP ghi đè slot)
    await this.fingerprintsRepo.delete({
      deviceId: device.id,
      fingerId,
    });

    // Gán vân tay cho user này
    const fingerprint = this.fingerprintsRepo.create({
      userId: pending.userId,
      locationId: device.locationId,
      deviceId: device.id,
      fingerId,
    });

    await this.fingerprintsRepo.save(fingerprint);
    this.logger.log(`Successfully linked finger_id ${fingerId} to user ${pending.userId}`);

    // Cập nhật pending enrollment trạng thái thành công thay vì xóa ngay
    pending.status = 'success';
    pending.fingerId = fingerId;
    await this.pendingRepo.save(pending);
  }

  private async handleEnrollmentFailed(device: Device, errorMsg?: string) {
    this.logger.warn(`Device ${device.clientId} failed to enroll: ${errorMsg}`);

    // Xóa các pending enrollments đã hết hạn
    await this.pendingRepo.delete({ expiresAt: LessThan(new Date()) });

    const pending = await this.pendingRepo.findOne({
      where: { locationId: device.locationId, status: 'pending' },
      order: { createdAt: 'DESC' },
    });

    if (!pending) {
      this.logger.warn(`No pending enrollment found for location ${device.locationId}`);
      return;
    }

    pending.status = 'failed';
    pending.error = errorMsg || 'Enrollment failed on device';
    await this.pendingRepo.save(pending);
  }

  private async handleCheckin(device: Device, fingerId: number, direction?: 'in' | 'out' | 'unknown') {
    // Tìm vân tay tương ứng với fingerId trên thiết bị này
    const fingerprint = await this.fingerprintsRepo.findOne({
      where: {
        deviceId: device.id,
        fingerId,
      }
    });

    if (!fingerprint) {
      this.logger.warn(`Fingerprint ID ${fingerId} not found on device ${device.clientId}`);
      return;
    }

    // Fetch the location's startTime and schedule
    const location = await this.locationsRepo.findOne({ where: { id: device.locationId } });
    
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long' });
    const dayMap: Record<string, number> = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };
    const dayOfWeek = dayMap[dayName];

    let startTimeStr = '08:00';
    let isEnabled = true;

    if (location?.workSchedule && location.workSchedule[dayOfWeek]) {
      const schedule = location.workSchedule[dayOfWeek];
      isEnabled = schedule.enabled;
      startTimeStr = schedule.startTime;
    } else {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        isEnabled = false;
      } else {
        startTimeStr = location?.startTime || '08:00';
      }
    }

    const checkinTime = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });

    const status = isEnabled ? (checkinTime <= startTimeStr ? 'success' : 'late') : 'success';

    // Ghi nhận CheckIn
    const checkin = this.checkinsRepo.create({
      userId: fingerprint.userId,
      locationId: device.locationId,
      checkedInAt: now,
      status,
      direction: direction || 'unknown',
      note: `Check-in via fingerprint on device ${device.name || device.clientId}`,
    });

    await this.checkinsRepo.save(checkin);
    this.logger.log(`User ${fingerprint.userId} checked in (${status}) successfully at location ${device.locationId}`);
  }

  /**
   * Publish lệnh enroll vân tay tới thiết bị qua MQTT
   */
  publishEnrollCommand(clientId: string): void {
    this.publishDeviceCommand(clientId, 'enroll');
  }

  /**
   * Publish lệnh điều khiển tới thiết bị qua MQTT
   */
  publishDeviceCommand(clientId: string, command: string, extra?: Record<string, any>): void {
    const commandTopic = this.configService.get<string>('MQTT_TOPIC_COMMAND') || 'command/fingerprint';
    const payload = JSON.stringify({
      command,
      client_id: clientId,
      ...extra,
    });

    if (!this.client || !this.client.connected) {
      this.logger.warn(`MQTT client not connected, cannot publish command: ${command}`);
      return;
    }

    this.client.publish(commandTopic, payload, { qos: 1 }, (err) => {
      if (err) {
        this.logger.error(`Failed to publish command ${command} to ${clientId}`, err);
      } else {
        this.logger.log(`Published command ${command} to ${commandTopic} for device ${clientId}`);
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // WIFI CHECK-IN VIA MQTT
  // ─────────────────────────────────────────────────────────────

  private async handleWifiAuthRequestMQTT(device: Device, payload: any) {
    const { token, device_uuid, client_mac } = payload;

    if (!token || !device_uuid) {
      this.logger.warn(`Missing token or device_uuid in wifi_auth_request payload from ${device.clientId}`);
      return;
    }

    let decodedToken: any;
    try {
      decodedToken = await this.jwtService.verifyAsync(token);
    } catch (err) {
      this.logger.warn(`Invalid JWT token in wifi_auth_request payload from ${device.clientId}`);
      this.publishDeviceCommand(device.clientId, 'fraud_alarm');
      return;
    }

    const userId = decodedToken.sub; // Assuming JWT subject is user ID

    let userDevice = await this.userDevicesRepo.findOne({ where: { deviceUuid: device_uuid } });
    let isFraud = false;

    if (userDevice) {
      if (userDevice.userId !== userId) {
        isFraud = true;
        this.logger.warn(`Fraud detected during auth: Device UUID ${device_uuid} belongs to ${userDevice.userId}, but used by ${userId}`);
      }
    }

    if (client_mac && !isFraud) {
      const existingWithMac = await this.userDevicesRepo.findOne({
        where: { macAddress: client_mac },
      });
      if (existingWithMac && existingWithMac.userId !== userId) {
        isFraud = true;
        this.logger.warn(`Fraud detected during auth: MAC address ${client_mac} already used by another user (${existingWithMac.userId})`);
      }
    }

    if (isFraud) {
      this.publishDeviceCommand(device.clientId, 'fraud_alarm');
      this.logger.log(`Sent fraud_alarm command to device ${device.clientId} due to fraudulent wifi_auth_request`);
    } else {
      this.publishDeviceCommand(device.clientId, 'open_door');
      this.logger.log(`Sent open_door command to device ${device.clientId} after successful wifi_auth_request`);
    }
  }

  private async handleWifiCheckinMQTT(device: Device, payload: any) {
    const { token, device_uuid, client_mac, direction } = payload;

    if (!token || !device_uuid) {
      this.logger.warn(`Missing token or device_uuid in wifi_checkin payload from ${device.clientId}`);
      return;
    }

    let decodedToken: any;
    try {
      decodedToken = await this.jwtService.verifyAsync(token);
    } catch (err) {
      this.logger.warn(`Invalid JWT token in wifi_checkin payload from ${device.clientId}`);
      return;
    }

    const userId = decodedToken.sub; // Assuming JWT subject is user ID

    let userDevice = await this.userDevicesRepo.findOne({ where: { deviceUuid: device_uuid } });
    let status: 'success' | 'late' | 'fraud' = 'success';
    let note = `Check-in via Wi-Fi (MQTT) on device ${device.name || device.clientId}`;

    if (userDevice) {
      if (userDevice.userId !== userId) {
        status = 'fraud';
        note = 'FRAUD WARNING: Device UUID registered to another user';
        this.logger.warn(`Fraud detected: Device UUID ${device_uuid} belongs to ${userDevice.userId}, but used by ${userId}`);
      } else {
        // Update MAC if missing
        if (client_mac && userDevice.macAddress !== client_mac) {
          userDevice.macAddress = client_mac;
          await this.userDevicesRepo.save(userDevice);
        }
      }
    } else {
      // Auto-register device for the user if it doesn't exist
      userDevice = this.userDevicesRepo.create({
        userId,
        deviceUuid: device_uuid,
        macAddress: client_mac || null,
      });
      await this.userDevicesRepo.save(userDevice);
    }

    // Check duplicate MAC with different User ID
    if (client_mac && status !== 'fraud') {
      const existingWithMac = await this.userDevicesRepo.findOne({
        where: { macAddress: client_mac },
      });
      if (existingWithMac && existingWithMac.userId !== userId) {
        status = 'fraud';
        note = `FRAUD WARNING: MAC address ${client_mac} already used by another user (${existingWithMac.userId})`;
        this.logger.warn(note);
      }
    }

    // Determine if late based on schedule (if not fraud)
    if (status !== 'fraud') {
      const location = await this.locationsRepo.findOne({ where: { id: device.locationId } });
      const now = new Date();
      const dayName = now.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long' });
      const dayMap: Record<string, number> = {
        Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
      };
      const dayOfWeek = dayMap[dayName];

      let startTimeStr = '08:00';
      let isEnabled = true;

      if (location?.workSchedule && location.workSchedule[dayOfWeek]) {
        const schedule = location.workSchedule[dayOfWeek];
        isEnabled = schedule.enabled;
        startTimeStr = schedule.startTime;
      } else {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          isEnabled = false;
        } else {
          startTimeStr = location?.startTime || '08:00';
        }
      }

      const checkinTime = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh', hour12: false, hour: '2-digit', minute: '2-digit'
      });

      if (isEnabled && checkinTime > startTimeStr) {
        status = 'late';
      }
    }

    // Check existing check-in today
    const nowLocal = new Date();
    const startOfDay = new Date(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Create CheckIn record
    const checkin = this.checkinsRepo.create({
      userId,
      locationId: device.locationId,
      checkedInAt: new Date(),
      status,
      direction: direction || 'unknown',
      note,
    });

    await this.checkinsRepo.save(checkin);
    this.logger.log(`User ${userId} checked in (${status}) via WiFi (MQTT) at location ${device.locationId}`);
  }

  // ─────────────────────────────────────────────────────────────
  // FREE ACCESS SCHEDULE
  // ─────────────────────────────────────────────────────────────

  private async checkFreeAccessSchedules() {
    try {
      const locations = await this.locationsRepo.find({ relations: ['devices'] });
      const now = new Date();
      const currentTimeStr = now.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
      });

      for (const loc of locations) {
        if (!loc.devices || loc.devices.length === 0) continue;

        let shouldBeFreeAccess = false;
        if (loc.freeAccessEnabled && loc.freeAccessStartTime && loc.freeAccessEndTime) {
          if (currentTimeStr >= loc.freeAccessStartTime && currentTimeStr < loc.freeAccessEndTime) {
            shouldBeFreeAccess = true;
          }
        }

        const currentState = this.freeAccessState.get(loc.id) || false;

        if (shouldBeFreeAccess !== currentState) {
          this.freeAccessState.set(loc.id, shouldBeFreeAccess);
          this.logger.log(`Location ${loc.id} (${loc.name}) free access state changed to: ${shouldBeFreeAccess}`);
          
          for (const device of loc.devices) {
            this.publishDeviceCommand(device.clientId, 'set_free_access', { enabled: shouldBeFreeAccess });
          }
        }
      }
    } catch (err) {
      this.logger.error('Error in checkFreeAccessSchedules', err);
    }
  }
}
