import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { UpdateCheckinRequest } from 'libs';

export class UpdateCheckinDto implements UpdateCheckinRequest {
  @IsDateString()
  @IsOptional()
  checkedInAt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  note?: string;
}
