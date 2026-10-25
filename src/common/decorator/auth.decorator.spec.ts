import { describe, it, expect } from 'vitest';
import { Auth } from './auth.decorator.js';
import { RoleGuard } from '../guard/role.guard.js';

describe('Auth decorator', () => {
  it('applies RoleGuard and default empty permissions', () => {
    const decorator = Auth();
    const target = function handler() {};

    decorator(target);

    const guards = Reflect.getMetadata('__guards__', target) as unknown[];
    expect(guards).toContain(RoleGuard);

    const permissions = Reflect.getMetadata('permissions', target);
    expect(permissions).toEqual([]);
  });

  it('stores provided permissions on the handler', () => {
    const decorator = Auth(['read', 'write']);
    const target = function handler() {};

    decorator(target);

    expect(Reflect.getMetadata('permissions', target)).toEqual([
      'read',
      'write',
    ]);
  });
});
