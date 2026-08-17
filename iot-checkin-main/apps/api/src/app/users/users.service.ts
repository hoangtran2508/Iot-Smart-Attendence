import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {  UpdateUserRequest, UserResponse, UserRole } from 'libs';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { UserDevice } from '../../entities/user-device.entity';
import { UserFactoryService } from './user.factory.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(UserDevice)
    private readonly userDevicesRepository: Repository<UserDevice>,
    private readonly userFactory: UserFactoryService,
  ) {}

  async findAll(): Promise<UserResponse[]> {
    const users = await this.usersRepository.find({ order: { createdAt: 'DESC' } });
    return users.map((user) => this.userFactory.toUserResponse(user));
  }

  async findOne(id: string): Promise<UserResponse> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.userFactory.toUserResponse(user);
  }

  async update(id: string, dto: UpdateUserRequest): Promise<UserResponse> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.name = dto.name ?? user.name;
    user.email = dto.email ?? user.email;
    if (dto.phoneNumber !== undefined) {
      user.phoneNumber = dto.phoneNumber;
    }
    const saved = await this.usersRepository.save(user);
    return this.userFactory.toUserResponse(saved);
  }

  async updateRole(id: string, role: UserRole): Promise<UserResponse> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.role = role;
    const saved = await this.usersRepository.save(user);
    return this.userFactory.toUserResponse(saved);
  }

  async remove(id: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    await this.usersRepository.remove(user);
  }

  async getUserDevices(userId: string) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.userDevicesRepository.find({ where: { userId } });
  }

  async removeUserDevice(userId: string, deviceId: string): Promise<void> {
    const device = await this.userDevicesRepository.findOne({ where: { id: deviceId, userId } });
    if (!device) {
      throw new NotFoundException('User device not found');
    }
    await this.userDevicesRepository.remove(device);
  }

}
