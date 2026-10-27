import type { ConfigService } from '@nestjs/config';

export function readPositiveInt(
  config: ConfigService,
  name: string,
  fallback: number,
): number {
  const raw = config.get<string>(name);
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
