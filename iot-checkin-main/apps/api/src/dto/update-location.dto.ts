import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { UpdateLocationRequest } from 'libs';

export class UpdateLocationDto implements UpdateLocationRequest {
  @IsString()
  @IsOptional()
  @MaxLength(160)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsNumber()
  @IsOptional()
  lat?: number;

  @IsNumber()
  @IsOptional()
  lng?: number;
}
