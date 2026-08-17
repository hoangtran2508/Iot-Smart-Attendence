import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateDeviceRequest } from 'libs';

export class CreateDeviceDto implements CreateDeviceRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  clientId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(160)
  name?: string;
}
