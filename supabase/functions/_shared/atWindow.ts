/**
 * AT Portal Time Window Helper
 *
 * The AT (Autoridade Tributária) portal is only reliably accessible during
 * specific time windows. The canonical windows (decided in F0.8) are:
 *   - Morning: 06:00–06:15 (Europe/Lisbon)
 *   - Evening: 19:30–19:45 (Europe/Lisbon)
 *
 * These match the pg_cron scheduler windows in run_scheduled_at_sync().
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
 * Check if a given UTC time falls within the AT portal time windows.
 *
 * Windows (in Europe/Lisbon timezone):
 *   - 06:00–06:15
 *   - 19:30–19:45
 */
export function isWithinATWindow(now?: Date): ATWindowResult {
  const utcNow = now || new Date();
  const { hours, minutes } = getLisbonTime(utcNow);
  const timeMinutes = hours * 60 + minutes;

  // Morning window: 06:00 (360) to 06:15 (375)
  const morningStart = 360;
  const morningEnd = 375;
  // Evening window: 19:30 (1170) to 19:45 (1185)
  const eveningStart = 1170;
  const eveningEnd = 1185;

  const isWithin =
    (timeMinutes >= morningStart && timeMinutes <= morningEnd) ||
    (timeMinutes >= eveningStart && timeMinutes <= eveningEnd);

  // Calculate next window
  let nextStart: string;
  let nextEnd: string;

  if (timeMinutes < morningStart) {
    nextStart = "06:00";
    nextEnd = "06:15";
  } else if (timeMinutes <= morningEnd) {
    nextStart = "06:00";
    nextEnd = "06:15";
  } else if (timeMinutes < eveningStart) {
    nextStart = "19:30";
    nextEnd = "19:45";
  } else if (timeMinutes <= eveningEnd) {
    nextStart = "19:30";
    nextEnd = "19:45";
  } else {
    nextStart = "06:00";
    nextEnd = "06:15";
  }

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
