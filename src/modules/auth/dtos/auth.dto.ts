import { ObjectType, Field } from '@nestjs/graphql';
import { GeneralResponse } from '../../../common/graphql/general-response.type.js';
import { UserType } from '../../user/dto/user.types.js';

@ObjectType()
export class AuthPayloadType {
  @Field(() => UserType)
  user: UserType;

  @Field(() => String)
  accessToken: string;

  @Field(() => String)
  refreshToken: string;
}

@ObjectType()
export class AuthResponse extends GeneralResponse(AuthPayloadType) {}

