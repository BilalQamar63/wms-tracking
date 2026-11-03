export function getDailyRegisterWorkHours(
  startTime?: string,
  endTime?: string,
  extendedHours?: string,
): number | undefined {
  const extraHours = getExtendedHoursValue(extendedHours);
  const hasWorkTimes = !!startTime && !!endTime;
  if (!hasWorkTimes) return extraHours > 0 ? extraHours : undefined;
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const start = timePattern.exec(startTime);
  const end = timePattern.exec(endTime);
  if (!start || !end) return undefined;

  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  let endMinutes = Number(end[1]) * 60 + Number(end[2]);
  if (endMinutes === startMinutes) return extraHours > 0 ? extraHours : undefined;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return (endMinutes - startMinutes) / 60 + extraHours;
}

export function getExtendedHoursValue(value?: string): number {
  if (!value) return 0;
  const time = /^([0-4]\d):([0-5]\d)$/.exec(value);
  if (time) return (Number(time[1]) * 60 + Number(time[2])) / 60;
  const legacyHours = Number(value);
  return Number.isFinite(legacyHours) && legacyHours > 0 ? legacyHours : 0;
}

export function formatExtendedHours(value?: string): string {
  if (!value) return '';
  const hours = getExtendedHoursValue(value);
  if (!hours) return '';
  const totalMinutes = Math.round(hours * 60);
  return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
}
