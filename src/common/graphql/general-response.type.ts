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

export interface IGeneralResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  timeStamp: string;
  data?: T;
}

export interface IPaginatedData<T> {
  paginationInfo: PaginationInfo;
  items: T[];
}

export interface IPaginatedResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  timeStamp: string;
  data?: IPaginatedData<T>;
}

export function GeneralResponse<T>(classRef: Type<T>): Type<IGeneralResponse<T>> {
  @ObjectType({ isAbstract: true })
  abstract class GeneralResponseClass implements IGeneralResponse<T> {
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
  return GeneralResponseClass as Type<IGeneralResponse<T>>;
}

export function PaginatedResponse<T>(classRef: Type<T>): Type<IPaginatedResponse<T>> {
  const name = classRef.name || 'Item';

  @ObjectType(`Paginated${name}Data`)
  abstract class PaginatedDataClass implements IPaginatedData<T> {
    @Field(() => PaginationInfo)
    paginationInfo: PaginationInfo;

    @Field(() => [classRef])
    items: T[];
  }

  @ObjectType({ isAbstract: true })
  abstract class PaginatedResponseClass implements IPaginatedResponse<T> {
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
  return PaginatedResponseClass as Type<IPaginatedResponse<T>>;
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
