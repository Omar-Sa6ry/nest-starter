import { IsNotEmpty, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class RoomDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  room: string;
}

export class SendRoomMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  room: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;

  // Optional application payload forwarded to the other room members as-is
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}

export class GetPresenceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  userId: string;
}
