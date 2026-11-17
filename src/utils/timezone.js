const TIMEZONE = "Asia/Kolkata";

/**
 * Get weekday name in Asia/Kolkata (e.g. "Monday", "Tuesday", etc.)
 */
const getKolkataWeekday = (date) => {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: TIMEZONE,
  }).format(new Date(date));
};

/**
 * Get HH:mm time string in Asia/Kolkata (24-hour format, e.g. "09:30", "14:00")
 */
const getKolkataTimeString = (date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIMEZONE,
  }).formatToParts(new Date(date));

  const hour = parts.find((p) => p.type === "hour").value;
  const minute = parts.find((p) => p.type === "minute").value;
  return `${hour}:${minute}`;
};

/**
 * Get YYYY-MM-DD date string in Asia/Kolkata
 */
const getKolkataDateString = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIMEZONE,
  }).formatToParts(new Date(date));

  const year = parts.find((p) => p.type === "year").value;
  const month = parts.find((p) => p.type === "month").value;
  const day = parts.find((p) => p.type === "day").value;
  return `${year}-${month}-${day}`;
};

/**
 * Get start and end UTC Date objects for a calendar day in Asia/Kolkata.
 * Asia/Kolkata is UTC+5:30.
 */
const getKolkataDayRange = (dateInput) => {
  const kolkataDateStr =
    typeof dateInput === "string" && dateInput.length === 10
      ? dateInput
      : getKolkataDateString(dateInput);

  const start = new Date(`${kolkataDateStr}T00:00:00.000+05:30`);
  const end = new Date(`${kolkataDateStr}T23:59:59.999+05:30`);
  return { start, end, dateString: kolkataDateStr };
};

/**
 * Check if a time string (HH:mm) is within start and end time (HH:mm) inclusive
 */
const isTimeWithinRange = (timeStr, startTimeStr, endTimeStr) => {
  const start = startTimeStr || "09:00";
  const end = endTimeStr || "17:00";
  return timeStr >= start && timeStr <= end;
};

module.exports = {
  TIMEZONE,
  getKolkataWeekday,
  getKolkataTimeString,
  getKolkataDateString,
  getKolkataDayRange,
  isTimeWithinRange,
};
