/**
 * AT Portal Time Window Helper
 *
 * The AT (Autoridade Tributária) portal is reliably accessible during
 * the overnight window: 19:00–06:00 (Europe/Lisbon).
 *
 * Manual syncs are blocked outside this window to prevent false auth errors.
 * The pg_cron scheduler runs at 06:00 and 19:30 within this window.
 */

interface ATWindowResult {
  isWithin: boolean;
  /** Next window opening in ISO format */
  nextWindowStart: string;
  /** Next window closing in ISO format */
  nextWindowEnd: string;
  /** Human-readable message in Portuguese */
  message: string;
}

/**
 * Parse a UTC date into Lisbon local time components.
 * Portugal uses WET (UTC+0) in winter and WEST (UTC+1) in summer.
 * DST: last Sunday of March → last Sunday of October.
 */
function getLisbonTime(utcDate: Date): { hours: number; minutes: number; date: Date } {
  // Use Intl to get the correct offset for Lisbon
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Lisbon",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const hours = parseInt(parts.find(p => p.type === "hour")?.value || "0");
  const minutes = parseInt(parts.find(p => p.type === "minute")?.value || "0");

  return { hours, minutes, date: utcDate };
}

/**
 * Check if a given UTC time falls within the AT portal time window.
 *
 * Window (in Europe/Lisbon timezone): 19:00–06:00 (overnight)
 */
export function isWithinATWindow(now?: Date): ATWindowResult {
  const utcNow = now || new Date();
  const { hours, minutes } = getLisbonTime(utcNow);
  const timeMinutes = hours * 60 + minutes;

  // Overnight window: 19:00 (1140) to 06:00 (360) next day
  const eveningStart = 1140; // 19:00
  const morningEnd = 360;    // 06:00

  // Window wraps midnight: 19:00→23:59 OR 00:00→06:00
  const isWithin = timeMinutes >= eveningStart || timeMinutes <= morningEnd;

  const nextStart = "19:00";
  const nextEnd = "06:00";

  const message = isWithin
    ? `Dentro da janela AT (${nextStart}–${nextEnd} Lisboa)`
    : `Fora da janela AT. Próxima janela: ${nextStart}–${nextEnd} (hora de Lisboa)`;

  return {
    isWithin,
    nextWindowStart: nextStart,
    nextWindowEnd: nextEnd,
    message,
  };
}
