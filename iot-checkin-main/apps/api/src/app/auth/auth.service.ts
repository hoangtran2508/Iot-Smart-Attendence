import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { User } from '../../entities/user.entity';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthResponse, LoginRequest, RegisterRequest } from 'libs';

@Injectable()
export class AuthService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
    this.client = new OAuth2Client(this.clientId);
  }

  private generateToken(user: User): AuthResponse {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: user.updatedAt ? user.updatedAt.toISOString() : new Date().toISOString(),
      },
    };
  }

  async login(dto: LoginRequest): Promise<AuthResponse> {
    const user = await this.usersRepository.createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: dto.email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password || !dto.password) {
      throw new UnauthorizedException('Invalid credentials or user registered via Google');
    }

    const isMatch = await bcrypt.compare(dto.password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateToken(user);
  }

  async register(dto: RegisterRequest): Promise<AuthResponse> {
    const existingUser = await this.usersRepository.findOne({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('Email is already registered');
    }

    if (!dto.password) {
      throw new BadRequestException('Password is required');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    let user = this.usersRepository.create({
      name: dto.name,
      email: dto.email,
      password: hashedPassword,
      role: 'user',
    });

    user = await this.usersRepository.save(user);

    return this.generateToken(user);
  }

  async googleLogin(idToken: string): Promise<AuthResponse> {
    if (!idToken) {
      throw new UnauthorizedException('Missing google idToken');
    }

    if (!this.clientId) {
      throw new UnauthorizedException('Missing GOOGLE_CLIENT_ID on server');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      const payload = ticket.getPayload();
      const email = payload?.email;

      if (!email) {
        throw new UnauthorizedException('Invalid identity token');
      }

      let user = await this.usersRepository.findOne({ where: { email } });
      if (!user) {
        user = this.usersRepository.create({
          email,
          name: payload?.name ?? email,
          role: 'user',
        });
        user = await this.usersRepository.save(user);
      }

      return this.generateToken(user);
    } catch (e) {
      throw new UnauthorizedException('Google authentication failed');
    }
  }
}
