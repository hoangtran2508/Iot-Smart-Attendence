import { Controller, Get, Post, Body } from '@nestjs/common';
import { User } from './user.decorator';
import { AuthenticatedUser } from './auth.types';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { LoginRequest, RegisterRequest, GoogleLoginRequest, AuthResponse } from 'libs';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginRequest): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterRequest): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginRequest): Promise<AuthResponse> {
    return this.authService.googleLogin(dto.idToken);
  }

  @Get('me')
  getProfile(@User() user: AuthenticatedUser) {
    return user;
  }
}
