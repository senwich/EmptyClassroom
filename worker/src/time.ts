const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

export function shanghaiNow(): Date {
  return new Date();
}

export function parseShanghaiDateTime(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}+08:00`);
}

export function parseShanghaiDate(value: string): Date {
  return new Date(`${value}T00:00:00+08:00`);
}

export function shanghaiWeekday(date: Date): number {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS).getUTCDay();
}

export function toIsoFromShanghaiNow(): string {
  return new Date().toISOString();
}
