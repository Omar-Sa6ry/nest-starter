import {
  GeneralResponse,
  PaginatedResponse,
  PaginationInfo,
  BooleanResponse,
  IntResponse,
} from './general-response.type.js';

class OrderPayload {
  id!: string;
}

class DriverPayload {
  name!: string;
}

describe('GeneralResponse', () => {
  it('returns a distinct abstract class per payload type', () => {
    const withOrders = GeneralResponse(OrderPayload);
    const withDrivers = GeneralResponse(DriverPayload);

    expect(withOrders).toBeDefined();
    expect(withOrders).not.toBe(withDrivers);
    expect(withOrders.name).toBe('GeneralResponseClass');
  });
});

describe('PaginationInfo', () => {
  it('can be instantiated', () => {
    const info = new PaginationInfo();
    info.totalItems = 10;
    info.currentPage = 1;
    info.nextPage = 2;

    expect(info.totalItems).toBe(10);
    expect(info.currentPage).toBe(1);
    expect(info.nextPage).toBe(2);
  });
});

describe('PaginatedResponse', () => {
  it('returns a distinct abstract class per payload type', () => {
    const withOrders = PaginatedResponse(OrderPayload);
    const withDrivers = PaginatedResponse(DriverPayload);

    expect(withOrders).toBeDefined();
    expect(withOrders).not.toBe(withDrivers);
    expect(withOrders.name).toBe('PaginatedResponseClass');
  });
});

describe('BooleanResponse', () => {
  it('defaults to a successful boolean response', () => {
    const response = new BooleanResponse();

    expect(response.message).toBe('Operation executed successfully');
    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(new Date(response.timeStamp as string).toISOString()).toBe(response.timeStamp);
    expect(response.data).toBeUndefined();
  });

  it('carries a boolean payload', () => {
    const response = new BooleanResponse();
    response.data = false;
    response.success = false;
    response.statusCode = 409;

    expect(response.data).toBe(false);
    expect(response.success).toBe(false);
    expect(response.statusCode).toBe(409);
  });
});

describe('IntResponse', () => {
  it('defaults to a successful integer response', () => {
    const response = new IntResponse();

    expect(response.message).toBe('Operation executed successfully');
    expect(response.success).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(new Date(response.timeStamp as string).toISOString()).toBe(response.timeStamp);
    expect(response.data).toBeUndefined();
  });

  it('carries an integer payload', () => {
    const response = new IntResponse();
    response.data = 42;

    expect(response.data).toBe(42);
  });
});