/**
 * hebcal.js – Hebrew ↔ Gregorian date conversion
 * Includes full Adar I / Adar II rules as specified.
 */
const HebCal = (() => {

  // Month names. Index 12 = Adar (regular year) or Adar I (leap).
  // Index 13 = Adar II (leap year only).
  const MONTH_NAMES = [
    '', 'ניסן', 'אייר', 'סיוון', 'תמוז', 'אב', 'אלול',
    'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט',
    'אדר',    // 12 – regular Adar / Adar I in leap
    'אדר א',  // 12 leap display
    'אדר ב'   // 13
  ];

  // ── Hebrew numeral helpers ──────────────────────────────────────────────

  function numToHebrew(n) {
    // Returns a string like תשפ"ו for a Hebrew year
    const H = [
      [400,'ת'],[300,'ש'],[200,'ר'],[100,'ק'],
      [90,'צ'],[80,'פ'],[70,'ע'],[60,'ס'],[50,'ן'],[40,'מ'],
      [30,'ל'],[20,'כ'],[16,'טז'],[15,'טו'],[10,'י'],
      [9,'ט'],[8,'ח'],[7,'ז'],[6,'ו'],[5,'ה'],
      [4,'ד'],[3,'ג'],[2,'ב'],[1,'א']
    ];
    let s = '';
    // Reduce thousands (e.g. 5786 → work with 786, prefix ה' for millennium)
    const thou = Math.floor(n / 1000);
    n = n % 1000;
    for (const [v, c] of H) {
      while (n >= v) { s += c; n -= v; }
    }
    // Add geresh / gershayim
    if (s.length === 1) return s + "'";
    return s.slice(0, -1) + '"' + s.slice(-1);
  }

  const DAY_LETTERS = [
    '','א','ב','ג','ד','ה','ו','ז','ח','ט',
    'י','יא','יב','יג','יד','טו','טז','יז','יח','יט',
    'כ','כא','כב','כג','כד','כה','כו','כז','כח','כט','ל'
  ];

  function dayToHeb(d) { return DAY_LETTERS[d] || String(d); }

  // ── Hebrew calendar arithmetic ──────────────────────────────────────────

  function isLeapYear(y) {
    return ((7 * y) + 1) % 19 < 7;
  }

  function monthsInYear(y) {
    return isLeapYear(y) ? 13 : 12;
  }

  // Elapsed days from Hebrew epoch to start of Hebrew year y
  function elapsedDays(y) {
    const monthsElapsed = Math.floor((235 * y - 234) / 19);
    const parts = 12084 + 13753 * monthsElapsed;
    let day = monthsElapsed * 29 + Math.floor(parts / 25920);
    if ((3 * (day + 1)) % 7 < 3) day += 1;
    return day;
  }

  function daysInYear(y) {
    return elapsedDays(y + 1) - elapsedDays(y);
  }

  function daysInMonth(m, y) {
    switch (m) {
      case 1: return 30;  // Nisan
      case 2: return 29;  // Iyar
      case 3: return 30;  // Sivan
      case 4: return 29;  // Tammuz
      case 5: return 30;  // Av
      case 6: return 29;  // Elul
      case 7: return 30;  // Tishri
      case 8: return daysInYear(y) % 10 === 5 ? 30 : 29; // Heshvan
      case 9: return daysInYear(y) % 10 === 3 ? 29 : 30; // Kislev
      case 10: return 29; // Tevet
      case 11: return 30; // Shevat
      case 12: return isLeapYear(y) ? 30 : 29; // Adar I or Adar
      case 13: return 29; // Adar II
      default: return 29;
    }
  }

  // Hebrew date → absolute day number (days since some epoch)
  function hebToAbs(y, m, d) {
    let abs = d + elapsedDays(y) - 1373429; // offset to align with Gregorian epoch
    // Add months before m
    if (m < 7) {
      for (let i = 7; i <= monthsInYear(y); i++) abs += daysInMonth(i, y);
      for (let i = 1; i < m; i++) abs += daysInMonth(i, y);
    } else {
      for (let i = 7; i < m; i++) abs += daysInMonth(i, y);
    }
    return abs;
  }

  // Gregorian date → absolute day number
  function gregToAbs(y, m, d) {
    let abs = d;
    for (let i = 1; i < m; i++) abs += daysInGregorianMonth(i, y);
    return (abs + 365 * (y - 1) + Math.floor((y - 1) / 4)
            - Math.floor((y - 1) / 100) + Math.floor((y - 1) / 400));
  }

  function isGregorianLeap(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function daysInGregorianMonth(m, y) {
    const days = [0,31,28,31,30,31,30,31,31,30,31,30,31];
    if (m === 2 && isGregorianLeap(y)) return 29;
    return days[m];
  }

  // Absolute day → Gregorian date
  function absToGreg(abs) {
    let y = Math.floor(abs / 366);
    while (gregToAbs(y + 1, 1, 1) <= abs) y++;
    let m = 1;
    while (gregToAbs(y, m + 1, 1) <= abs) m++;
    const d = abs - gregToAbs(y, m, 1) + 1;
    return { year: y, month: m, day: d };
  }

  // Absolute day → Hebrew date
  function absToHeb(abs) {
    let y = Math.floor((abs + 1373429) / 365.25) - 1;
    while (hebToAbs(y + 1, 7, 1) <= abs) y++;
    const months = monthsInYear(y);
    let m = 7;
    while (true) {
      const dim = daysInMonth(m, y);
      const startAbs = hebToAbs(y, m, 1);
      if (abs < startAbs + dim) {
        return { year: y, month: m, day: abs - startAbs, isLeap: isLeapYear(y) };
      }
      m = (m === months) ? 1 : m + 1;
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Convert Gregorian date string "YYYY-MM-DD" to Hebrew date object.
   * Returns:
   *   { year, month, day, isLeap, adarType, display, short }
   *
   * adarType:
   *   null    – not an Adar month
   *   'regular' – born in Adar of a regular year
   *   'I'     – born in Adar I of a leap year
   *   'II'    – born in Adar II of a leap year
   */
  function fromGregorian(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const abs = gregToAbs(y, m, d);
    const h = absToHeb(abs);

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

  /**
   * Given a stored birth Hebrew date and an adarType,
   * return the Gregorian date (and Hebrew date string) for that birthday
   * in the given Gregorian year.
   */
  function getBirthdayInYear(birthHeb, targetGregYear) {
    // Try Hebrew years that could fall in targetGregYear
    for (let offset = 0; offset <= 1; offset++) {
      const hYear = targetGregYear + 3760 + offset;
      const m = resolveAdarMonth(birthHeb.month, birthHeb.adarType, hYear);
      let day = birthHeb.day;
      const maxDay = daysInMonth(m, hYear);
      if (day > maxDay) day = maxDay;

      const abs = hebToAbs(hYear, m, day);
      const greg = absToGreg(abs);

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
    const abs = hebToAbs(hYear, m, day);
    const greg = absToGreg(abs);
    const hDate = { year: hYear, month: m, day, isLeap: isLeapYear(hYear) };
    return {
      gYear: greg.year, gMonth: greg.month, gDay: greg.day,
      hDateFull: formatFull(hDate, birthHeb.adarType),
      hDateShort: formatShort(hDate, birthHeb.adarType),
      hDate
    };
  }

  /**
   * Resolve which Hebrew month number to use for a given target year,
   * applying the Adar rules.
   */
  function resolveAdarMonth(birthMonth, adarType, targetYear) {
    if (birthMonth !== 12 && birthMonth !== 13) return birthMonth;
    const leap = isLeapYear(targetYear);
    if (!leap) return 12; // All Adar variants → Adar in regular year
    // Target is a leap year:
    if (adarType === 'II' || birthMonth === 13) return 13; // Adar II
    if (adarType === 'I') return 12;                       // Adar I
    return 13; // regular Adar → Adar II in leap year
  }

  function formatFull(h, adarType) {
    const monthName = getMonthName(h.month, h.isLeap, adarType);
    return `${dayToHeb(h.day)}' ב${monthName} ה'${numToHebrew(h.year)}`;
  }

  function formatShort(h, adarType) {
    const monthName = getMonthName(h.month, h.isLeap, adarType);
    return `${dayToHeb(h.day)}' ב${monthName}`;
  }

  function getMonthName(month, isLeap, adarType) {
    if (month === 12) {
      if (isLeap) return 'אדר א\'';
      return 'אדר';
    }
    if (month === 13) return 'אדר ב\'';
    return MONTH_NAMES[month];
  }

  return { fromGregorian, getBirthdayInYear, isLeapYear };
})();
