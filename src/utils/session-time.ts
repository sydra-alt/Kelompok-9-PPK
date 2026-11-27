import type { PracticeSession } from '@/types';

const TIME_ZONE = 'Asia/Jakarta';

export function getJakartaNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00';
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  };
}

function jakartaDateTime(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!dateMatch || !timeMatch) return null;
  const [, year, month, day] = dateMatch;
  const [, hour, minute] = timeMatch;
  // Jakarta is UTC+7. Store/compare absolute instants regardless of device timezone.
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 7, Number(minute)));
}

export function isSessionStartAllowed(date: string, startTime: string, now = new Date()): boolean {
  const current = getJakartaNowParts(now);
  return date > current.date || (date === current.date && startTime >= current.time);
}

export function isWithinSessionWindow(session: PracticeSession, now = new Date()): boolean {
  const start = jakartaDateTime(session.date, session.startTime);
  const end = jakartaDateTime(session.date, session.endTime);
  return Boolean(start && end && now >= start && now < end);
}

export function hasSessionEnded(session: PracticeSession, now = new Date()): boolean {
  const end = jakartaDateTime(session.date, session.endTime);
  return Boolean(end && now >= end);
}
