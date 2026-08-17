import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CheckinResponse, CreateCheckinRequest, UpdateCheckinRequest, WifiCheckinRequest } from 'libs';
import { MoreThan, Repository } from 'typeorm';
import { CheckIn } from '../../entities/checkin.entity';
import { CheckinKey } from '../../entities/checkin-key.entity';
import { Device } from '../../entities/device.entity';
import { Location } from '../../entities/location.entity';
import { User } from '../../entities/user.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { CheckinFactoryService } from './checkin.factory.service';

@Injectable()
export class CheckinsService {
  private readonly logger = new Logger(CheckinsService.name);

  constructor(
    @InjectRepository(CheckIn)
    private readonly checkinsRepository: Repository<CheckIn>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    @InjectRepository(CheckinKey)
    private readonly checkinKeysRepository: Repository<CheckinKey>,
    @InjectRepository(Device)
    private readonly devicesRepository: Repository<Device>,
    @InjectRepository(UserDevice)
    private readonly userDevicesRepository: Repository<UserDevice>,
    private readonly checkinFactory: CheckinFactoryService,
  ) {}

  async create(dto: CreateCheckinRequest, currentUserId: string): Promise<CheckinResponse> {
    const userId = dto.userId || currentUserId;

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const location = await this.locationsRepository.findOne({
      where: { id: dto.locationId },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const checkedInAt = dto.checkedInAt ? new Date(dto.checkedInAt) : new Date();
    if (Number.isNaN(checkedInAt.getTime())) {
      throw new BadRequestException('Invalid checkedInAt value');
    }

    // Check for existing check-in today
    const startOfDay = new Date(checkedInAt);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(checkedInAt);
    endOfDay.setHours(23, 59, 59, 999);

    const existingCheckin = await this.checkinsRepository.findOne({
      where: {
        userId,
        locationId: dto.locationId,
        checkedInAt: MoreThan(startOfDay), // Simplify query, effectively checking if >= startOfDay since we also should check <= endOfDay if we care about future, but usually checkedInAt is now
      },
      order: { checkedInAt: 'DESC' }
    });

    if (existingCheckin && existingCheckin.checkedInAt <= endOfDay) {
      throw new ConflictException('Bạn đã điểm danh tại địa điểm này trong ngày hôm nay.');
    }

    const dayName = checkedInAt.toLocaleDateString('en-US', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'long' });
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

    if (location.workSchedule && location.workSchedule[dayOfWeek]) {
      const schedule = location.workSchedule[dayOfWeek];
      isEnabled = schedule.enabled;
      startTimeStr = schedule.startTime;
    } else {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        isEnabled = false;
      } else {
        startTimeStr = location.startTime || '08:00';
      }
    }

    const checkinTime = checkedInAt.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    const status = isEnabled ? (checkinTime <= startTimeStr ? 'success' : 'late') : 'success';

    const checkin = this.checkinsRepository.create({
      userId,
      locationId: dto.locationId,
      checkedInAt,
      status,
      note: dto.note,
    });

    const saved = await this.checkinsRepository.save(checkin);
    saved.user = user;
    saved.location = location;
    return this.checkinFactory.toCheckinResponse(saved);
  }

  /**
   * WiFi proximity check-in: validate the challenge key from ESP device.
   */
  async createWifiCheckin(dto: WifiCheckinRequest, currentUserId: string): Promise<CheckinResponse> {
    const user = await this.usersRepository.findOne({ where: { id: currentUserId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!dto.deviceUuid) {
      throw new BadRequestException('deviceUuid is required for check-in');
    }

    // Anti-fraud: Device Binding Check
    let userDevice = await this.userDevicesRepository.findOne({ where: { deviceUuid: dto.deviceUuid } });
    
    if (userDevice) {
      if (userDevice.userId !== currentUserId) {
        this.logger.warn(`Fraud attempt: User ${currentUserId} trying to check in with device ${dto.deviceUuid} registered to ${userDevice.userId}`);
        throw new ForbiddenException('Thiết bị này đã được đăng ký cho một tài khoản khác.');
      }
      // Update mac address if provided and different
      if (dto.mac && userDevice.macAddress !== dto.mac) {
        userDevice.macAddress = dto.mac;
        await this.userDevicesRepository.save(userDevice);
      }
    } else {
      // Device not found. Check if user already has a device.
      const existingUserDevices = await this.userDevicesRepository.find({ where: { userId: currentUserId } });
      if (existingUserDevices.length > 0) {
        throw new ForbiddenException('Vui lòng sử dụng thiết bị đã đăng ký của bạn để điểm danh.');
      }
      // Auto-register device for this user
      userDevice = this.userDevicesRepository.create({
        userId: currentUserId,
        deviceUuid: dto.deviceUuid,
        macAddress: dto.mac || null,
      });
      await this.userDevicesRepository.save(userDevice);
      this.logger.log(`Auto-registered device ${dto.deviceUuid} for user ${currentUserId}`);
    }

    // Find the device by deviceId
    const device = await this.devicesRepository.findOne({ where: { clientId: dto.deviceId } });
    if (!device) {
      throw new NotFoundException(`Device with id "${dto.deviceId}" not found`);
    }

    // Validate the key: must match, not expired
    const checkinKey = await this.checkinKeysRepository.findOne({
      where: {
        deviceId: device.id,
        key: dto.key,
        expiresAt: MoreThan(new Date()),
      },
    });

    if (!checkinKey) {
      this.logger.warn(
        `WiFi check-in rejected: invalid/expired key for device ${dto.deviceId} from user ${currentUserId}`,
      );
      throw new UnauthorizedException('Invalid or expired check-in key');
    }

    // Verify locationId matches the device's location
    if (device.locationId !== dto.locationId) {
      throw new BadRequestException('Location does not match the device location');
    }

    const location = await this.locationsRepository.findOne({ where: { id: dto.locationId } });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    const now = new Date();

    // Check for existing check-in today
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const existingCheckin = await this.checkinsRepository.findOne({
      where: {
        userId: currentUserId,
        locationId: dto.locationId,
        checkedInAt: MoreThan(startOfDay),
      },
      order: { checkedInAt: 'DESC' }
    });

    if (existingCheckin && existingCheckin.checkedInAt <= endOfDay) {
      throw new ConflictException('Bạn đã điểm danh tại địa điểm này trong ngày hôm nay.');
    }

    // Create the check-in record
    const noteDetails = [
      `WiFi check-in via device ${device.name || device.clientId}`,
      dto.direction ? `Direction: ${dto.direction}` : null,
      dto.mac ? `MAC: ${dto.mac}` : null,
      dto.rssi !== undefined ? `RSSI: ${dto.rssi}dBm` : null,
    ].filter(Boolean).join(' | ');

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

    if (location.workSchedule && location.workSchedule[dayOfWeek]) {
      const schedule = location.workSchedule[dayOfWeek];
      isEnabled = schedule.enabled;
      startTimeStr = schedule.startTime;
    } else {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        isEnabled = false;
      } else {
        startTimeStr = location.startTime || '08:00';
      }
    }

    const checkinTime = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    const status = isEnabled ? (checkinTime <= startTimeStr ? 'success' : 'late') : 'success';

    const checkin = this.checkinsRepository.create({
      userId: currentUserId,
      locationId: dto.locationId,
      checkedInAt: now,
      status,
      note: noteDetails,
    });

    const saved = await this.checkinsRepository.save(checkin);
    saved.user = user;
    saved.location = location;

    this.logger.log(
      `WiFi check-in success (${status}): user ${currentUserId} at location ${dto.locationId} via device ${dto.deviceId}`,
    );

    return this.checkinFactory.toCheckinResponse(saved);
  }

  async findAll(): Promise<CheckinResponse[]> {
    const checkins = await this.checkinsRepository.find({
      relations: { user: true, location: true },
      order: { checkedInAt: 'DESC' },
    });
    return checkins.map((checkin) => this.checkinFactory.toCheckinResponse(checkin));
  }

  async findAllForUser(userId: string, role: string): Promise<CheckinResponse[]> {
    if (role === 'admin') {
      return this.findAll();
    }

    const checkins = await this.checkinsRepository.createQueryBuilder('checkin')
      .leftJoinAndSelect('checkin.user', 'user')
      .leftJoinAndSelect('checkin.location', 'location')
      .leftJoin('location.admin', 'admin')
      .where('checkin.userId = :userId', { userId })
      .orWhere('admin.id = :userId', { userId })
      .orderBy('checkin.checkedInAt', 'DESC')
      .getMany();

    return checkins.map((checkin) => this.checkinFactory.toCheckinResponse(checkin));
  }

  async findOne(id: string, currentUserId: string, currentUserRole: string): Promise<CheckinResponse> {
    const checkin = await this.checkinsRepository.findOne({
      where: { id },
      relations: { user: true, location: { admin: true } },
    });
    if (!checkin) {
      throw new NotFoundException('Check-in not found');
    }

    if (currentUserRole !== 'admin'
      && checkin.userId !== currentUserId
      && checkin.location?.admin?.id !== currentUserId) {
      throw new ForbiddenException('Forbidden resources');
    }

    return this.checkinFactory.toCheckinResponse(checkin);
  }

  async update(
    id: string,
    dto: UpdateCheckinRequest,
    currentUserId: string,
    currentUserRole: string,
  ): Promise<CheckinResponse> {
    const checkin = await this.checkinsRepository.findOne({
      where: { id },
      relations: { user: true, location: { admin: true } },
    });
    if (!checkin) {
      throw new NotFoundException('Check-in not found');
    }

    if (currentUserRole !== 'admin'
      && checkin.userId !== currentUserId
      && checkin.location?.admin?.id !== currentUserId) {
      throw new ForbiddenException('Forbidden resources');
    }

    if (dto.checkedInAt !== undefined) {
      const checkedInAt = new Date(dto.checkedInAt);
      if (Number.isNaN(checkedInAt.getTime())) {
        throw new BadRequestException('Invalid checkedInAt value');
      }
      checkin.checkedInAt = checkedInAt;
    }

    if (dto.note !== undefined) {
      checkin.note = dto.note ?? null;
    }

    const saved = await this.checkinsRepository.save(checkin);
    saved.user = checkin.user;
    saved.location = checkin.location;
    return this.checkinFactory.toCheckinResponse(saved);
  }

  async remove(id: string, currentUserId: string, currentUserRole: string): Promise<void> {
    const checkin = await this.checkinsRepository.findOne({
      where: { id },
      relations: { location: { admin: true } },
    });
    if (!checkin) {
      throw new NotFoundException('Check-in not found');
    }

    if (currentUserRole !== 'admin'
      && checkin.userId !== currentUserId
      && checkin.location?.admin?.id !== currentUserId) {
      throw new ForbiddenException('Forbidden resources');
    }

    await this.checkinsRepository.remove(checkin);
  }
}
