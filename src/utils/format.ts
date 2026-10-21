/**
 * Helper format tanggal/waktu. Parsing dilakukan manual dari string
 * (YYYY-MM-DD / YYYY-MM-DDTHH:mm:ss) agar konsisten di semua platform.
 */

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

const pad = (value: number) => String(value).padStart(2, '0');

/** "2026-10-21" -> "Rabu, 21 Okt 2026" */
export function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return `${DAYS[parsed.getDay()]}, ${day} ${MONTHS[month - 1]} ${year}`;
}

/** "08:00", "10:00" -> "08:00 – 10:00 WIB" */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime} – ${endTime} WIB`;
}

/** "2026-10-21T08:07:12" -> "08:07" */
export function formatClock(dateTime: string): string {
  return dateTime.split('T')[1]?.slice(0, 5) ?? '-';
}

/** "2026-10-21T08:07:12" -> "Rabu, 21 Okt 2026 • 08:07 WIB" */
export function formatDateTime(dateTime: string): string {
  const [datePart] = dateTime.split('T');
  return `${formatDate(datePart)} • ${formatClock(dateTime)} WIB`;
}

/** Waktu lokal saat ini dalam format YYYY-MM-DDTHH:mm:ss */
export function nowLocalDateTime(date: Date = new Date()): string {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/** "Ahmad Fauzan" -> "AF" */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}
