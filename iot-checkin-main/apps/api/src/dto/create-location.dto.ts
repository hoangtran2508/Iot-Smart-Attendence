import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateLocationRequest } from 'libs';

export class CreateLocationDto implements CreateLocationRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;
}
