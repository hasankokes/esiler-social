import { CHANNELS, dayIndex, type Channel, type Config, type Slot } from "./config.js";

export type Occurrence = {
  key: string; // "2026-11-02_pzt-kartela" — posted_state.json anahtarı
  date: string; // yerel tarih YYYY-MM-DD
  at: Date; // UTC zaman
  slot: Slot;
};

// Verilen anın saat dilimindeki tarih/saat parçaları.
export function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hh: +parts.hour, mm: +parts.minute, weekday: wd };
}

const offsetMinutes = (d: Date, tz: string) => {
  const lp = localParts(d, tz);
  const [y, m, day] = lp.date.split("-").map(Number);
  const asUtc = Date.UTC(y, m - 1, day, lp.hh, lp.mm);
  return Math.round((asUtc - Math.floor(d.getTime() / 60000) * 60000) / 60000);
};

// Yerel "YYYY-MM-DD" + "SS:DD" → UTC Date
export function zonedTime(date: string, hhmm: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(guess.getTime() - offsetMinutes(guess, tz) * 60000);
}

export const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
};

const weekdayOf = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

export const slotActive = (s: Slot) => s.aktif !== false;

// [from, to] aralığındaki tüm slot tekrarları, zamana göre sıralı.
export function occurrencesBetween(cfg: Config, from: Date, to: Date): Occurrence[] {
  const tz = cfg.schedule.saat_dilimi;
  const holidays = new Set(cfg.schedule.tatiller ?? []);
  const out: Occurrence[] = [];
  let date = localParts(from, tz).date;
  const last = localParts(to, tz).date;
  while (date <= last) {
    const wd = weekdayOf(date);
    if (!holidays.has(date)) {
      for (const slot of cfg.schedule.slotlar) {
        if (!slotActive(slot) || dayIndex(slot.gun) !== wd) continue;
        const at = zonedTime(date, slot.saat, tz);
        if (at >= from && at <= to) out.push({ key: `${date}_${slot.id}`, date, at, slot });
      }
    }
    date = addDays(date, 1);
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime());
}

// Bu slot için açık kanallar (ana şalter + slot ayarı).
export function channelsFor(cfg: Config, slot: Slot): Channel[] {
  return CHANNELS.filter((c) => cfg.schedule.kanallar?.[c] !== false && slot.kanallar?.[c] !== false);
}

// Haftanın pazartesisi (yerel tarih).
export function weekStart(date: string) {
  const wd = weekdayOf(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

// "2026-W45" biçiminde ISO hafta etiketi.
export function isoWeek(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
