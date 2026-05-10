// ── Configuration ─────────────────────────────────────────────────────────
const CLIENT_ID = window.APP_CONFIG?.clientId || '';
const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/spreadsheets';
const SHEET_ID = '1qhAlOrbRUbI5EyoX165oGuSpeOV6RCcVZYHbDzZai5w';
const SHEET_NAME = 'גיליון1';

// ── State ──────────────────────────────────────────────────────────────────
let birthdays = [];
let tokenClient = null;
let accessToken = null;
let deleteTarget = null;

// ── Boot ───────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  loadData();
  renderTable();
  initGoogleAuth();
});

// ── Data: localStorage ─────────────────────────────────────────────────────
async function loadData() {
  if (!accessToken) {
    const raw = localStorage.getItem('birthdays');
    birthdays = raw ? JSON.parse(raw) : [];
    return;
  }
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A1`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const json = await res.json();
    const val = json.values?.[0]?.[0];
    birthdays = val ? JSON.parse(val) : [];
    localStorage.setItem('birthdays', JSON.stringify(birthdays));
  } catch (e) {
    console.error('Load error:', e);
    const raw = localStorage.getItem('birthdays');
    birthdays = raw ? JSON.parse(raw) : [];
  }
}

async function saveData() {
  localStorage.setItem('birthdays', JSON.stringify(birthdays));
  if (!accessToken) return;
  try {
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${SHEET_NAME}!A1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: `${SHEET_NAME}!A1`,
          majorDimension: 'ROWS',
          values: [[JSON.stringify(birthdays)]]
        })
      }
    );
  } catch (e) {
    console.error('Save error:', e);
  }
}

// ── Google Auth ────────────────────────────────────────────────────────────
function initGoogleAuth() {
  if (!CLIENT_ID) return;
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.onload = () => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: onTokenReceived,
    });
  };
  document.head.appendChild(script);
}

function handleAuth() {
  if (!tokenClient) {
    showMessage('form-message', 'הגדרות Google חסרות.', 'error');
    return;
  }
  tokenClient.requestAccessToken();
}

function onTokenReceived(resp) {
  if (resp.error) return;
  accessToken = resp.access_token;
  loadData().then(() => renderTable());
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  .then(r => r.json())
  .then(info => {
    document.getElementById('auth-buttons').style.display = 'none';
    document.getElementById('auth-user').style.display = 'block';
    document.getElementById('auth-user-name').textContent = info.email || 'מחובר';
    document.getElementById('cal-dot').className = 'dot ok';
    document.getElementById('cal-status-text').textContent = 'מחובר ל-Google';
  });
}

function handleSignOut() {
  if (accessToken) google.accounts.oauth2.revoke(accessToken);
  accessToken = null;
  document.getElementById('auth-buttons').style.display = 'block';
  document.getElementById('auth-user').style.display = 'none';
  document.getElementById('cal-dot').className = 'dot';
  document.getElementById('cal-status-text').textContent = 'לא מסונכרן';
}

// ── Hebrew date preview ────────────────────────────────────────────────────
function updateHebrewPreview() {
  const val = document.getElementById('birthDate').value;
  const preview = document.getElementById('hebrewPreview');
  if (!val) { preview.textContent = '— הזן תאריך לועזי —'; return; }
  try {
    const h = HebCal.fromGregorian(val);
    preview.textContent = h.display;
  } catch (e) {
    preview.textContent = 'שגיאה בהמרה';
  }
}

// ── Add birthday ───────────────────────────────────────────────────────────
function addBirthday() {
  const firstName = document.getElementById('firstName').value.trim();
  const lastName  = document.getElementById('lastName').value.trim();
  const birthDate = document.getElementById('birthDate').value;

  if (!firstName || !lastName || !birthDate) {
    showMessage('form-message', 'יש למלא את כל השדות.', 'error');
    return;
  }

  const dup = birthdays.find(b =>
    b.firstName === firstName &&
    b.lastName  === lastName  &&
    b.birthDate === birthDate
  );
  if (dup) {
    showMessage('form-message', 'יום הולדת זה כבר קיים ברשימה.', 'error');
    return;
  }

  const hDate = HebCal.fromGregorian(birthDate);

  const entry = {
    id: Date.now().toString(),
    firstName,
    lastName,
    birthDate,
    hebrewDate: {
      year: hDate.year,
      month: hDate.month,
      day: hDate.day,
      isLeap: hDate.isLeap,
      adarType: hDate.adarType,
      display: hDate.display
    },
    calendarEventIds: {}
  };

  birthdays.push(entry);
  saveData();
  renderTable();
  clearForm();
  showMessage('form-message', `${firstName} ${lastName} נוסף/ה בהצלחה! 🎉`, 'success');
}

// ── Age calculations ───────────────────────────────────────────────────────
function calcGregorianAge(birthDateStr) {
  const [by, bm, bd] = birthDateStr.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - by;
  if (now.getMonth() + 1 < bm || (now.getMonth() + 1 === bm && now.getDate() < bd)) age--;
  return age;
}

function calcHebrewAge(birthHeb) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const bd = HebCal.getBirthdayInYear(birthHeb, currentYear);
  const bdDate = new Date(bd.gYear, bd.gMonth - 1, bd.gDay);
  const birthHYear = birthHeb.year;
  const currentHYear = currentYear + 3760;
  let age = currentHYear - birthHYear;
  if (now < bdDate) age--;
  return age;
}

// ── Render table ───────────────────────────────────────────────────────────
function renderTable() {
  const tbody = document.getElementById('birthday-list');
  if (birthdays.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">
      <div class="empty-state"><div class="icon">🎂</div><div>טרם נוספו ימי הולדת</div></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = birthdays.map(b => {
    const gAge = calcGregorianAge(b.birthDate);
    const hAge = calcHebrewAge(b.hebrewDate);
    const [y, m, d] = b.birthDate.split('-');
    const gDisplay = `${d}/${m}/${y}`;
    return `<tr>
      <td><strong>${b.firstName} ${b.lastName}</strong></td>
      <td>${gDisplay}</td>
      <td><span class="age-badge">${gAge}</span></td>
      <td style="font-family:'Frank Ruhl Libre',serif; color:var(--gold-light);">${b.hebrewDate.display}</td>
      <td><span class="age-badge">${hAge}</span></td>
      <td>
        <button class="btn btn-danger btn-sm" onclick="openDeleteModal('${b.id}')">🗑 מחק</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Delete ─────────────────────────────────────────────────────────────────
function openDeleteModal(id) {
  deleteTarget = id;
  const b = birthdays.find(x => x.id === id);
  if (b) {
    document.getElementById('delete-modal-text').textContent =
      `האם אתה בטוח שברצונך למחוק את יום ההולדת של ${b.firstName} ${b.lastName}? הפעולה תמחק גם את האירועים ביומן Google.`;
  }
  document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
  deleteTarget = null;
  document.getElementById('delete-modal').style.display = 'none';
}

async function confirmDelete() {
  if (!deleteTarget) return;
  const b = birthdays.find(x => x.id === deleteTarget);
  if (b && accessToken) {
    const ids = b.calendarEventIds || {};
    for (const year of Object.keys(ids)) {
      const { gregorianId, hebrewId } = ids[year];
      if (gregorianId) await deleteCalendarEvent(gregorianId);
      if (hebrewId) await deleteCalendarEvent(hebrewId);
    }
  }
  birthdays = birthdays.filter(x => x.id !== deleteTarget);
  saveData();
  renderTable();
  closeDeleteModal();
}

// ── Google Calendar Sync ───────────────────────────────────────────────────
async function syncAllToCalendar() {
  if (!accessToken) {
    showMessage('form-message', 'יש להתחבר לחשבון Google תחילה.', 'error');
    return;
  }
  const btn = document.getElementById('sync-btn');
  btn.innerHTML = '<span class="spinner"></span> מסנכרן...';
  btn.disabled = true;

  const currentYear = new Date().getFullYear();

  for (const b of birthdays) {
    await syncBirthdayYear(b, currentYear);
  }

  saveData();
  renderTable();
  btn.innerHTML = '🔄 סנכרן ליומן';
  btn.disabled = false;
  document.getElementById('cal-dot').className = 'dot ok';
  document.getElementById('cal-status-text').textContent = 'מסונכרן ✓';
}

async function syncBirthdayYear(b, year) {
  const [by, bm, bd] = b.birthDate.split('-').map(Number);
  const gAge = year - by;
  const gEventDate = `${year}-${String(bm).padStart(2,'0')}-${String(bd).padStart(2,'0')}`;
  const gTitle = `יום הולדת ${gAge} ל-${b.firstName} ${b.lastName}`;

  const hBd = HebCal.getBirthdayInYear(b.hebrewDate, year);
  const hAge = year - (b.hebrewDate.year - 3760);
  const hEventDate = `${hBd.gYear}-${String(hBd.gMonth).padStart(2,'0')}-${String(hBd.gDay).padStart(2,'0')}`;
  const hTitle = `יום הולדת עברי ${hAge} ל-${b.firstName} ${b.lastName} (${hBd.hDateShort})`;

  const existing = b.calendarEventIds?.[year] || {};
  if (existing.gregorianId) await deleteCalendarEvent(existing.gregorianId);
  if (existing.hebrewId)    await deleteCalendarEvent(existing.hebrewId);

  const gId = await createCalendarEvent(gTitle, gEventDate);
  const hId = await createCalendarEvent(hTitle, hEventDate);

  if (!b.calendarEventIds) b.calendarEventIds = {};
  b.calendarEventIds[year] = { gregorianId: gId, hebrewId: hId };
}

async function createCalendarEvent(title, dateStr) {
  const body = {
    summary: title,
    start: { date: dateStr },
    end:   { date: dateStr },
    colorId: '11',
    reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 480 }] }
  };
  try {
    const res = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }
    );
    const json = await res.json();
    return json.id || null;
  } catch (e) {
    console.error('Create event error:', e);
    return null;
  }
}

async function deleteCalendarEvent(eventId) {
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
    );
  } catch (e) {
    console.error('Delete event error:', e);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function clearForm() {
  document.getElementById('firstName').value = '';
  document.getElementById('lastName').value  = '';
  document.getElementById('birthDate').value = '';
  document.getElementById('hebrewPreview').textContent = '— הזן תאריך לועזי —';
  document.getElementById('form-message').className = 'message';
}

function showMessage(id, text, type) {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = `message ${type}`;
  setTimeout(() => { el.className = 'message'; }, 5000);
}
