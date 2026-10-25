import { ObjectType, Field, Int } from '@nestjs/graphql';
import { Type } from '@nestjs/common';

@ObjectType()
export class PaginationInfo {
  @Field(() => Int)
  totalItems: number;

  @Field(() => Int)
  currentPage: number;

  @Field(() => Int, { nullable: true })
  nextPage?: number;
}

export function GeneralResponse<T>(classRef: Type<T>) {
  @ObjectType({ isAbstract: true })
  abstract class GeneralResponseClass {
    @Field(() => Boolean, { defaultValue: true })
    success: boolean = true;

    @Field(() => Int, { defaultValue: 200 })
    statusCode: number = 200;

    @Field(() => String, { defaultValue: 'Operation executed successfully' })
    message: string = 'Operation executed successfully';

    @Field(() => String)
    timeStamp: string = new Date().toISOString();

    @Field(() => classRef, { nullable: true })
    data?: T;
  }
  return GeneralResponseClass;
}

export function PaginatedResponse<T>(classRef: Type<T>) {
  @ObjectType({ isAbstract: true })
  abstract class PaginatedDataClass {
    @Field(() => PaginationInfo)
    paginationInfo: PaginationInfo;

    @Field(() => [classRef])
    items: T[];
  }

  @ObjectType({ isAbstract: true })
  abstract class PaginatedResponseClass {
    @Field(() => Boolean, { defaultValue: true })
    success: boolean = true;

    @Field(() => Int, { defaultValue: 200 })
    statusCode: number = 200;

    @Field(() => String, { defaultValue: 'Operation executed successfully' })
    message: string = 'Operation executed successfully';

    @Field(() => String)
    timeStamp: string = new Date().toISOString();

    @Field(() => PaginatedDataClass, { nullable: true })
    data?: PaginatedDataClass;
  }
  return PaginatedResponseClass;
}

@ObjectType()
export class BooleanResponse {
  @Field(() => Boolean, { defaultValue: true })
  success: boolean = true;

  @Field(() => Int, { defaultValue: 200 })
  statusCode: number = 200;

  @Field(() => String, { defaultValue: 'Operation executed successfully' })
  message: string = 'Operation executed successfully';

  @Field(() => String)
  timeStamp: string = new Date().toISOString();

  @Field(() => Boolean, { nullable: true })
  data?: boolean;
}

@ObjectType()
export class IntResponse {
  @Field(() => Boolean, { defaultValue: true })
  success: boolean = true;

  @Field(() => Int, { defaultValue: 200 })
  statusCode: number = 200;

  @Field(() => String, { defaultValue: 'Operation executed successfully' })
  message: string = 'Operation executed successfully';

  @Field(() => String)
  timeStamp: string = new Date().toISOString();

  @Field(() => Int, { nullable: true })
  data?: number;
}
