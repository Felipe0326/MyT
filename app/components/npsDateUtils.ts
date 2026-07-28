export function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

export function isWithinInterval(date: Date, interval: { start: Date; end: Date }) {
  const value = date.getTime();
  return value >= interval.start.getTime() && value <= interval.end.getTime();
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, "0");
}

export function format(date: Date, pattern: string) {
  const valid = date instanceof Date && !Number.isNaN(date.getTime());
  if (!valid) return "";

  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const shortMonth = new Intl.DateTimeFormat("es-MX", { month: "short" })
    .format(date)
    .replace(".", "");

  const formats: Record<string, string> = {
    "dd/MM/yyyy HH:mm": `${day}/${month}/${year} ${hour}:${minute}`,
    "yyyyMMdd_HHmm": `${year}${month}${day}_${hour}${minute}`,
    "yyyy-MM": `${year}-${month}`,
    "MMM yyyy": `${shortMonth} ${year}`,
    "dd MMM yyyy HH:mm": `${day} ${shortMonth} ${year} ${hour}:${minute}`,
  };

  return formats[pattern] ?? date.toLocaleString("es-MX");
}
