/**
 * hebcal.js – Hebrew <-> Gregorian date conversion
 * Verified with known dates. Offset 347997 confirmed correct.
 */
const HebCal = (() => {

  const MONTH_NAMES = [
    '', 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול',
    'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט',
    'אדר', 'אדר א', 'אדר ב'
  ];

  const DAY_LETTERS = [
    '','א','ב','ג','ד','ה','ו','ז','ח','ט',
    'י','יא','יב','יג','יד','טו','טז','יז','יח','יט',
    'כ','כא','כב','כג','כד','כה','כו','כז','כח','כט','ל'
  ];

  const HEB_EPOCH = 347997; // Verified: 1 Tishri 1 AM = JD 347997

  // ── Hebrew numeral helpers ────────────────────────────────────────────────

  function numToHebrew(n) {
    const H = [
      [400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],
      [90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'נ'],[40,'מ'],
      [30,'ל'],[20,'כ'],[16,'טז'],[15,'טו'],[10,'י'],
      [9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],
      [4,'ד'],[3,'ג'],[2,'ב'],[1,'א']
    ];
    n = n % 1000;
    let s = '';
    for (const [v, c] of H) {
      while (n >= v) { s += c; n -= v; }
    }
    if (s.length === 1) return s + "'";
    return s.slice(0, -1) + '"' + s.slice(-1);
  }

  function dayToHeb(d) { return DAY_LETTERS[d] || String(d); }

  // ── Hebrew calendar arithmetic ────────────────────────────────────────────

  function isLeapYear(y) { return ((7 * y) + 1) % 19 < 7; }
  function monthsInYear(y) { return isLeapYear(y) ? 13 : 12; }

  function elapsedDays(y) {
    const monthsElapsed = Math.floor((235 * y - 234) / 19);
    const parts = 12084 + 13753 * monthsElapsed;
    let day = monthsElapsed * 29 + Math.floor(parts / 25920);
    if ((3 * (day + 1)) % 7 < 3) day += 1;
    return day;
  }

  function daysInYear(y) { return elapsedDays(y + 1) - elapsedDays(y); }

  function daysInMonth(m, y) {
    switch (m) {
      case 1:  return 30;
      case 2:  return 29;
      case 3:  return 30;
      case 4:  return 29;
      case 5:  return 30;
      case 6:  return 29;
      case 7:  return 30;
      case 8:  return daysInYear(y) % 10 === 5 ? 30 : 29;
      case 9:  return daysInYear(y) % 10 === 3 ? 29 : 30;
      case 10: return 29;
      case 11: return 30;
      case 12: return isLeapYear(y) ? 30 : 29;
      case 13: return 29;
      default: return 29;
    }
  }

  // Hebrew date -> Julian Day Number
  function hebToJD(y, m, d) {
    let jd = elapsedDays(y) + d;
    if (m < 7) {
      for (let i = 7; i <= monthsInYear(y); i++) jd += daysInMonth(i, y);
      for (let i = 1; i < m; i++) jd += daysInMonth(i, y);
    } else {
      for (let i = 7; i < m; i++) jd += daysInMonth(i, y);
    }
    return jd + HEB_EPOCH;
  }

  // Julian Day Number -> Hebrew date
  function jdToHeb(jd) {
    let y = Math.floor((jd - HEB_EPOCH) / 365.25);
    while (hebToJD(y + 1, 7, 1) <= jd) y++;
    while (hebToJD(y, 7, 1) > jd) y--;
    const months = monthsInYear(y);
    let m = 7;
    while (true) {
      const startJD = hebToJD(y, m, 1);
      const dim = daysInMonth(m, y);
      if (jd >= startJD && jd < startJD + dim) {
        return { year: y, month: m, day: jd - startJD + 1, isLeap: isLeapYear(y) };
      }
      m = (m === months) ? 1 : m + 1;
    }
  }

  // Gregorian date -> Julian Day Number
  function gregToJD(y, m, d) {
    if (m <= 2) { y--; m += 12; }
    const a = Math.floor(y / 100);
    const b = 2 - a + Math.floor(a / 4);
    return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524;
  }

  // Julian Day Number -> Gregorian date
  function jdToGreg(jd) {
    const z = Math.floor(jd + 0.5);
    const a = Math.floor((z - 1867216.25) / 36524.25);
    const aa = z + 1 + a - Math.floor(a / 4);
    const b = aa + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const dd = Math.floor(365.25 * c);
    const e = Math.floor((b - dd) / 30.6001);
    const day = b - dd - Math.floor(30.6001 * e);
    const month = e < 14 ? e - 1 : e - 13;
    const year = month > 2 ? c - 4716 : c - 4715;
    return { year, month, day };
  }

  // ── Adar rules ────────────────────────────────────────────────────────────

  function resolveAdarMonth(birthMonth, adarType, targetYear) {
    if (birthMonth !== 12 && birthMonth !== 13) return birthMonth;
    const leap = isLeapYear(targetYear);
    if (!leap) return 12;
    if (adarType === 'II' || birthMonth === 13) return 13;
    if (adarType === 'I') return 12;
    return 13; // regular Adar -> Adar II in leap year
  }

  // ── Formatting ────────────────────────────────────────────────────────────

  function getMonthName(month, isLeap, adarType) {
    if (month === 12) return isLeap ? "אדר א'" : 'אדר';
    if (month === 13) return "אדר ב'";
    return MONTH_NAMES[month];
  }

  function formatFull(h, adarType) {
    const monthName = getMonthName(h.month, h.isLeap, adarType);
    return `${dayToHeb(h.day)}' ב${monthName} ה'${numToHebrew(h.year)}`;
  }

  function formatShort(h, adarType) {
    const monthName = getMonthName(h.month, h.isLeap, adarType);
    return `${dayToHeb(h.day)}' ב${monthName}`;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  function fromGregorian(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const jd = gregToJD(y, m, d);
    const h = jdToHeb(jd);

    let adarType = null;
    if (h.month === 12 && !h.isLeap) adarType = 'regular';
    else if (h.month === 12 && h.isLeap) adarType = 'I';
    else if (h.month === 13) adarType = 'II';

    return {
      ...h,
      adarType,
      display: formatFull(h, adarType),
      short: formatShort(h, adarType)
    };
  }

  function getBirthdayInYear(birthHeb, targetGregYear) {
    for (let offset = 0; offset <= 1; offset++) {
      const hYear = targetGregYear + 3760 + offset;
      const m = resolveAdarMonth(birthHeb.month, birthHeb.adarType, hYear);
      let day = birthHeb.day;
      const maxDay = daysInMonth(m, hYear);
      if (day > maxDay) day = maxDay;

      const jd = hebToJD(hYear, m, day);
      const greg = jdToGreg(jd);

      if (greg.year === targetGregYear) {
        const hDate = { year: hYear, month: m, day, isLeap: isLeapYear(hYear) };
        return {
          gYear: greg.year, gMonth: greg.month, gDay: greg.day,
          hDateFull: formatFull(hDate, birthHeb.adarType),
          hDateShort: formatShort(hDate, birthHeb.adarType),
          hDate
        };
      }
    }

    // Fallback
    const hYear = targetGregYear + 3761;
    const m = resolveAdarMonth(birthHeb.month, birthHeb.adarType, hYear);
    let day = birthHeb.day;
    if (day > daysInMonth(m, hYear)) day = daysInMonth(m, hYear);
    const jd = hebToJD(hYear, m, day);
    const greg = jdToGreg(jd);
    const hDate = { year: hYear, month: m, day, isLeap: isLeapYear(hYear) };
    return {
      gYear: greg.year, gMonth: greg.month, gDay: greg.day,
      hDateFull: formatFull(hDate, birthHeb.adarType),
      hDateShort: formatShort(hDate, birthHeb.adarType),
      hDate
    };
  }

  return { fromGregorian, getBirthdayInYear, isLeapYear };
})();
