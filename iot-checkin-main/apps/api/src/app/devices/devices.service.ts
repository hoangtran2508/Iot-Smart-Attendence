import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateDeviceRequest, DeviceResponse } from 'libs';
import { In, Repository } from 'typeorm';
import { Device } from '../../entities/device.entity';
import { Location } from '../../entities/location.entity';
import { Fingerprint } from '../../entities/fingerprint.entity';
import { CheckinKey } from '../../entities/checkin-key.entity';
import { StationScanReport } from '../../entities/station-scan-report.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { MqttService } from '../mqtt/mqtt.service';
import { DeviceFactoryService } from './device.factory.service';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    private readonly deviceFactory: DeviceFactoryService,
    private readonly mqttService: MqttService,
  ) {}

  async addDevice(
    locationId: string,
    dto: CreateDeviceRequest,
    currentUserId: string,
    currentUserRole: string,
  ): Promise<DeviceResponse> {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { admin: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Only the location admin can manage devices');
    }

    const existing = await this.devicesRepository.findOne({
      where: { clientId: dto.clientId },
    });
    if (existing) {
      throw new ConflictException(
        `Device with clientId "${dto.clientId}" is already registered`,
      );
    }

    const device = this.devicesRepository.create({
      clientId: dto.clientId,
      name: dto.name,
      locationId,
    });

    const saved = await this.devicesRepository.save(device);
    return this.deviceFactory.toDeviceResponse(saved);
  }

  async findByLocation(locationId: string): Promise<DeviceResponse[]> {
    const devices = await this.devicesRepository.find({
      where: { locationId },
      order: { createdAt: 'ASC' },
    });
    return devices.map((d) => this.deviceFactory.toDeviceResponse(d));
  }

  async removeDevice(
    locationId: string,
    deviceId: string,
    currentUserId: string,
    currentUserRole: string,
  ): Promise<void> {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { admin: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Only the location admin can manage devices');
    }

    const device = await this.devicesRepository.findOne({
      where: { id: deviceId, locationId },
    });
    if (!device) {
      throw new NotFoundException('Device not found in this location');
    }

    await this.devicesRepository.manager.delete(Fingerprint, { deviceId });
    await this.devicesRepository.manager.delete(CheckinKey, { deviceId });
    await this.devicesRepository.remove(device);
  }

  async publishDeviceCommand(
    locationId: string,
    deviceId: string,
    command: string,
    fingerId: number | undefined,
    currentUserId: string,
    currentUserRole: string,
  ): Promise<{ success: boolean }> {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { admin: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Only the location admin can control devices');
    }

    const device = await this.devicesRepository.findOne({
      where: { id: deviceId, locationId },
    });
    if (!device) {
      throw new NotFoundException('Device not found');
    }

    const extra = fingerId !== undefined ? { finger_id: fingerId } : undefined;
    this.mqttService.publishDeviceCommand(device.clientId, command, extra);

    return { success: true };
  }

  async getScanReports(
    locationId: string,
    currentUserId: string,
    currentUserRole: string,
  ) {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { admin: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Only the location admin can view scan reports');
    }

    const devices = await this.devicesRepository.find({ where: { locationId } });
    if (devices.length === 0) {
      return [];
    }

    const deviceIds = devices.map((d) => d.id);
    const reports = await this.devicesRepository.manager.find(StationScanReport, {
      where: { deviceId: In(deviceIds) },
      order: { createdAt: 'DESC' },
      take: 50,
      relations: { device: true },
    });

    return reports.map((r) => ({
      id: r.id,
      macs: r.macs,
      createdAt: r.createdAt.toISOString(),
      device: {
        id: r.device.id,
        name: r.device.name,
        clientId: r.device.clientId,
      },
    }));
  }

  async checkPresence(locationId: string, currentUserId: string): Promise<{ inRoom: boolean; lastSeenAt?: string }> {
    const location = await this.locationsRepository.findOne({ where: { id: locationId } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    // Get user's registered devices (MAC addresses)
    const userDevices = await this.devicesRepository.manager.find(UserDevice, {
      where: { userId: currentUserId },
    });
    
    if (userDevices.length === 0) {
      return { inRoom: false }; // No registered device, can't verify presence
    }

    const registeredMacs = userDevices
      .map(d => d.macAddress?.toLowerCase())
      .filter(Boolean) as string[];

    if (registeredMacs.length === 0) {
      return { inRoom: false }; // Device registered but no MAC stored yet
    }

    // Get devices in the location
    const espDevices = await this.devicesRepository.find({ where: { locationId } });
    if (espDevices.length === 0) {
      return { inRoom: false };
    }

    const deviceIds = espDevices.map(d => d.id);
    
    // Look at scan reports from the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentReports = await this.devicesRepository.manager.find(StationScanReport, {
      where: { deviceId: In(deviceIds) },
      order: { createdAt: 'DESC' },
      take: 20, // Check up to 20 recent reports
    });

    for (const report of recentReports) {
      if (report.createdAt < fiveMinutesAgo) continue;
      
      const scannedMacs = report.macs.map(mac => mac.toLowerCase());
      const hasMatch = registeredMacs.some(mac => scannedMacs.includes(mac));
      
      if (hasMatch) {
        return { inRoom: true, lastSeenAt: report.createdAt.toISOString() };
      }
    }

    return { inRoom: false };
  }
}
