// Generate ICS file content for a formation/session
// Importable in Google Calendar / Apple Calendar / Outlook → push notifs natives sur le téléphone

export type IcsEvent = {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  start: Date; // start of day
  end: Date;   // end of day (exclusive for all-day, but we use timed)
  allDay?: boolean;
  alarmMinutesBefore?: number; // default 60
};

const pad = (n: number) => String(n).padStart(2, "0");

const formatDateUTC = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

const formatDateOnly = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

const escape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

export function buildIcs(events: IcsEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SecureCRM//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}@securecrm`);
    lines.push(`DTSTAMP:${formatDateUTC(new Date())}`);
    if (ev.allDay) {
      const endPlus = new Date(ev.end);
      endPlus.setDate(endPlus.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${formatDateOnly(ev.start)}`);
      lines.push(`DTEND;VALUE=DATE:${formatDateOnly(endPlus)}`);
    } else {
      lines.push(`DTSTART:${formatDateUTC(ev.start)}`);
      lines.push(`DTEND:${formatDateUTC(ev.end)}`);
    }
    lines.push(`SUMMARY:${escape(ev.title)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escape(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${escape(ev.location)}`);

    const alarm = ev.alarmMinutesBefore ?? 60;
    lines.push("BEGIN:VALARM");
    lines.push("ACTION:DISPLAY");
    lines.push(`DESCRIPTION:${escape(ev.title)}`);
    lines.push(`TRIGGER:-PT${alarm}M`);
    lines.push("END:VALARM");

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".ics") ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
