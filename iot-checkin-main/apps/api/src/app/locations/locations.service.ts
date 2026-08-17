import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateLocationRequest, LocationResponse, UpdateLocationRequest } from 'libs';
import { Repository } from 'typeorm';
import { Location } from '../../entities/location.entity';
import { User } from '../../entities/user.entity';
import { LocationFactoryService } from './location.factory.service';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationsRepository: Repository<Location>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly locationFactory: LocationFactoryService,
  ) {}

  async create(dto: CreateLocationRequest, adminId: string): Promise<LocationResponse> {

    const admin = { id: adminId} as User;
    const joinCode = crypto.randomBytes(3).toString('hex').toUpperCase();

    const location = this.locationsRepository.create({
      ...dto,
      joinCode,
      admin,
    });
    const saved = await this.locationsRepository.save(location);
    return this.locationFactory.toLocationResponse(saved);
  }

  async findAllForUser(userId: string, role: string): Promise<LocationResponse[]> {
    if (role === 'admin') {
      const locations = await this.locationsRepository.find({
        relations: { admin: true, devices: true },
      });
      return locations.map((location) => this.locationFactory.toLocationResponse(location));
    }

    const locations = await this.locationsRepository.createQueryBuilder('location')
      .leftJoinAndSelect('location.admin', 'admin')
      .leftJoinAndSelect('location.devices', 'devices')
      .leftJoin('location.users', 'user')
      .where('admin.id = :userId', { userId })
      .orWhere('user.id = :userId', { userId })
      .getMany();

    return locations.map((location) => this.locationFactory.toLocationResponse(location));
  }

  async findOne(id: string, currentUserId: string, currentUserRole: string): Promise<LocationResponse> {
    const location = await this.locationsRepository.findOne({ 
      where: { id },
      relations: { users: true, admin: true, devices: true, fingerprints: true }, 
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (currentUserRole !== 'admin') {
      const isOwner = location.admin?.id === currentUserId;
      const isMember = location.users?.some((u) => u.id === currentUserId) ?? false;
      if (!isOwner && !isMember) {
        throw new ForbiddenException('Forbidden resources');
      }
    }

    return this.locationFactory.toLocationResponse(location);
  }

  async update(
    id: string,
    dto: UpdateLocationRequest,
    currentUserId: string,
    currentUserRole: string,
  ): Promise<LocationResponse> {
    const location = await this.locationsRepository.findOne({
      where: { id },
      relations: { admin: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Forbidden resources');
    }
    Object.assign(location, dto);
    const saved = await this.locationsRepository.save(location);
    return this.locationFactory.toLocationResponse(saved);
  }

  async joinByCode(userId: string, code: string): Promise<LocationResponse> {
    const location = await this.locationsRepository.findOne({
      where: { joinCode: code },
      relations: { users: true, admin: true, devices: true, fingerprints: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found or invalid code');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingUserIds = new Set((location.users ?? []).map((item) => item.id));
    if (!existingUserIds.has(user.id)) {
      location.users = [...(location.users ?? []), user];
      await this.locationsRepository.save(location);
    }

    return this.locationFactory.toLocationResponse(location);
  }

  async removeUser(
    locationId: string,
    userId: string,
    currentUserId: string,
    currentUserRole: string,
  ): Promise<LocationResponse> {
    const location = await this.locationsRepository.findOne({
      where: { id: locationId },
      relations: { users: true, admin: true, devices: true, fingerprints: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Forbidden resources');
    }

    if (location.users) {
      location.users = location.users.filter((user) => user.id !== userId);
      await this.locationsRepository.save(location);
    }

    return this.locationFactory.toLocationResponse(location);
  }

  async remove(id: string, currentUserId: string, currentUserRole: string): Promise<void> {
    const location = await this.locationsRepository.findOne({
      where: { id },
      relations: { admin: true },
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    if (location.admin?.id !== currentUserId && currentUserRole !== 'admin') {
      throw new ForbiddenException('Forbidden resources');
    }
    await this.locationsRepository.remove(location);
  }

}
