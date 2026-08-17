import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { CreateCheckinRequest } from 'libs';

export class CreateCheckinDto implements CreateCheckinRequest {
  @IsUUID()
  userId!: string;

  @IsUUID()
  locationId!: string;

  @IsDateString()
  @IsOptional()
  checkedInAt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  note?: string;
}
