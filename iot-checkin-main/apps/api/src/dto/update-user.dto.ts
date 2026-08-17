import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { UpdateUserRequest } from 'libs';

export class UpdateUserDto implements UpdateUserRequest {
  @IsString()
  @IsOptional()
  @MaxLength(120)
  name?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(200)
  email?: string;
}
