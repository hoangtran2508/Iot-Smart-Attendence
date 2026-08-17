import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../entities/device.entity';
import { Location } from '../../entities/location.entity';
import { PendingEnrollment } from '../../entities/pending-enrollment.entity';
import { MqttService } from '../mqtt/mqtt.service';

@Injectable()
export class FingerprintsService {
  constructor(
    @InjectRepository(PendingEnrollment)
    private readonly pendingEnrollmentsRepository: Repository<PendingEnrollment>,
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
    private readonly mqttService: MqttService,
  ) {}

  async requestEnroll(locationId: string, currentUserId: string, targetUserId?: string) {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { users: true, admin: true },
    });
    
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const enrollUserId = targetUserId || currentUserId;
    const isOwner = location.admin?.id === currentUserId;

    if (!isOwner) {
      throw new ForbiddenException('Only the location admin can enroll fingerprints');
    }

    // Check if user belongs to this location
    const isMember = location.users?.some((u) => u.id === enrollUserId);
    
    if (enrollUserId !== location.admin?.id && !isMember) {
      throw new ForbiddenException('The user must be a member of this location to enroll a fingerprint');
    }

    // Xóa các request cũ của user ở location này nếu có
    await this.pendingEnrollmentsRepository.delete({
      userId: enrollUserId,
      locationId,
    });

    // Hết hạn sau 5 phút
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const pending = this.pendingEnrollmentsRepository.create({
      userId: enrollUserId,
      locationId,
      expiresAt,
      status: 'pending',
    });

    await this.pendingEnrollmentsRepository.save(pending);

    // Gửi lệnh enroll tới tất cả device tại location này
    const devices = await this.devicesRepository.find({
      where: { locationId },
    });

    for (const device of devices) {
      this.mqttService.publishEnrollCommand(device.clientId);
    }

    return {
      message: 'Vui lòng đặt ngón tay lên thiết bị để đăng ký vân tay.',
      expiresAt: expiresAt.toISOString(),
    };
  }

  async getEnrollStatus(locationId: string, userId: string, currentUserId: string, currentUserRole: string) {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { admin: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Only the location admin can view enrollment status');
    }

    const pending = await this.pendingEnrollmentsRepository.findOne({
      where: { locationId, userId },
      order: { createdAt: 'DESC' },
    });

    if (!pending) {
      return { status: 'none' };
    }

    // Check if expired
    if (pending.status === 'pending' && new Date() > pending.expiresAt) {
      return { status: 'expired' };
    }

    return {
      status: pending.status,
      fingerId: pending.fingerId,
      error: pending.error,
    };
  }

  async clearEnrollStatus(locationId: string, userId: string, currentUserId: string, currentUserRole: string) {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { admin: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Only the location admin can manage enrollment');
    }
    await this.pendingEnrollmentsRepository.delete({ locationId, userId });
    return { success: true };
  }
}
