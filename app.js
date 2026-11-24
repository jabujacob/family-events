/* Family Events: shared calendar, RSVPs and task lists.
 * Runs in demo mode (data saved in this browser only) until Supabase details
 * are added to config.js. */
(() => {
  'use strict';

  const CFG = window.APP_CONFIG || {};
  const DEMO = !CFG.supabaseUrl || !CFG.supabaseAnonKey;
  const COLORS = ['#e07a5f', '#3d85c6', '#2f8f5b', '#8e6cc2', '#d4a017', '#c2557f', '#3a9fa3', '#7a6d64'];
  const STATUS = {
    going: { label: 'Going', emoji: '👍' },
    maybe: { label: 'Maybe', emoji: '🤔' },
    no: { label: "Can't go", emoji: '🙁' },
  };

  // ---------- Small helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => toISO(new Date());
  const addDays = (iso, n) => { const d = parse(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const fmtDate = (iso, o) => parse(iso).toLocaleDateString(undefined, o || { weekday: 'short', day: 'numeric', month: 'short' });
  const hhmm = (t) => (t ? t.slice(0, 5) : '');
  const fmtTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  };
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const initials = (name) => (name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  const clean = (s) => { const v = String(s ?? '').trim(); return v === '' ? null : v; };

  let toastTimer;
  function toast(msg, isErr) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'show' + (isErr ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, isErr ? 4500 : 2200);
  }
  function fail(err) {
    console.error(err);
    toast(err && err.message ? `Something went wrong: ${err.message}` : 'Something went wrong. Please try again.', true);
  }

  // ---------- Demo store (this browser only) ----------
  function makeDemoStore() {
    const KEY = 'family-events-demo-v2';
    const ME = 'you@example.com';
    const seed = () => {
      const t = today();
      const sat = addDays(t, (6 - parse(t).getDay() + 7) % 7 || 7);
      const e1 = uid(), e2 = uid(), e3 = uid(), e4 = uid(), e5 = uid();
      const sun = addDays(sat, 1);
      return {
        members: [
          { email: ME, name: 'You', color: COLORS[0], is_admin: true },
          { email: 'aroha@example.com', name: 'Aroha', color: COLORS[1], is_admin: false },
          { email: 'sam@example.com', name: 'Sam', color: COLORS[2], is_admin: false },
          { email: 'nana@example.com', name: 'Nana', color: COLORS[3], is_admin: false },
        ],
        events: [
          { id: e1, title: 'Family BBQ', start_date: sat, end_date: null, start_time: '12:00', end_time: '16:00', location: "Nana's place", notes: 'Bring a plate and something to drink.', created_by: ME },
          { id: e2, title: "Nana's 80th birthday", start_date: addDays(t, 16), end_date: null, start_time: '18:30', end_time: null, location: 'The Boatshed Restaurant', notes: 'Surprise! Do not tell Nana.', created_by: 'aroha@example.com' },
          { id: e3, title: 'Beach bach weekend', start_date: addDays(t, 24), end_date: addDays(t, 26), start_time: null, end_time: null, location: 'Raglan', notes: '', created_by: 'sam@example.com' },
          { id: e4, title: 'Sunday family dinner', start_date: sun, end_date: null, start_time: '17:30', end_time: null, location: 'Home', notes: 'Everyone welcome. Let us know if you are coming so we cook enough!', created_by: ME, repeat: 'weekly', repeat_until: null },
          { id: e5, title: "Aroha's birthday", start_date: addDays(t, 40), end_date: null, start_time: null, end_time: null, location: null, notes: '', created_by: 'sam@example.com', repeat: 'yearly', repeat_until: null },
        ],
        rsvps: [
          { event_id: e1, on_date: sat, email: 'aroha@example.com', status: 'going', note: null },
          { event_id: e1, on_date: sat, email: 'sam@example.com', status: 'maybe', note: 'Might be late' },
          { event_id: e2, on_date: addDays(t, 16), email: 'aroha@example.com', status: 'going', note: null },
          { event_id: e3, on_date: addDays(t, 24), email: 'nana@example.com', status: 'no', note: null },
          { event_id: e4, on_date: sun, email: 'nana@example.com', status: 'going', note: 'Bringing dessert' },
        ],
        tasks: [
          { id: uid(), title: 'Buy sausages and bread', event_id: e1, assigned_to: ME, due_date: addDays(sat, -1), done: false, created_by: ME },
          { id: uid(), title: 'Make a salad', event_id: e1, assigned_to: 'aroha@example.com', due_date: null, done: false, created_by: ME },
          { id: uid(), title: 'Order the birthday cake', event_id: e2, assigned_to: 'aroha@example.com', due_date: addDays(t, 10), done: false, created_by: 'aroha@example.com' },
          { id: uid(), title: 'Book the bach', event_id: e3, assigned_to: 'sam@example.com', due_date: null, done: true, created_by: 'sam@example.com' },
          { id: uid(), title: 'Renew passports', event_id: null, assigned_to: null, due_date: addDays(t, 30), done: false, created_by: ME },
        ],
      };
    };
    let db;
    try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
    if (!db || !db.members) db = seed();
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* private mode */ } };
    save();
    const copy = (x) => JSON.parse(JSON.stringify(x));
    const upsert = (list, row, key = 'id') => { const i = list.findIndex((r) => r[key] === row[key]); if (i >= 0) list[i] = { ...list[i], ...row }; else list.push(row); };

    return {
      demo: true,
      async init() {},
      email: () => ME,
      async signIn() {},
      async signOut() { db = seed(); save(); },
      async ensureMember() { return copy(db.members.find((m) => m.email === ME)); },
      async loadAll() { return copy(db); },
      async saveEvent(ev) { const row = { ...ev, id: ev.id || uid() }; if (!ev.id) row.created_by = ME; upsert(db.events, row); save(); return copy(row); },
      async deleteEvent(id) { db.events = db.events.filter((e) => e.id !== id); db.rsvps = db.rsvps.filter((r) => r.event_id !== id); db.tasks = db.tasks.filter((t) => t.event_id !== id); save(); },
      async setRsvp(event_id, on_date, status, note) {
        const i = db.rsvps.findIndex((r) => r.event_id === event_id && r.email === ME && r.on_date === on_date);
        if (!status) { if (i >= 0) db.rsvps.splice(i, 1); } else if (i >= 0) { db.rsvps[i] = { ...db.rsvps[i], status, note }; } else db.rsvps.push({ event_id, on_date, email: ME, status, note });
        save();
      },
      async saveTask(t) { const row = { ...t, id: t.id || uid() }; if (!t.id) { row.created_by = ME; row.done = !!t.done; } upsert(db.tasks, row); save(); return copy(row); },
      async deleteTask(id) { db.tasks = db.tasks.filter((t) => t.id !== id); save(); },
      async addMember(m) {
        if (db.members.some((x) => x.email === m.email)) throw new Error('That email is already on the family list.');
        db.members.push({ ...m, is_admin: false }); save();
      },
      async updateMember(email, patch) { upsert(db.members, { email, ...patch }, 'email'); save(); },
      async removeMember(email) {
        db.members = db.members.filter((m) => m.email !== email);
        db.rsvps = db.rsvps.filter((r) => r.email !== email);
        db.tasks.forEach((t) => { if (t.assigned_to === email) t.assigned_to = null; });
        save();
      },
    };
  }

  // ---------- Supabase store (shared with the family) ----------
  function makeSupabaseStore(onAuthChange) {
    const sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey);
    let session = null;
    const email = () => (session && session.user && session.user.email ? session.user.email.toLowerCase() : null);
    const ok = ({ data, error }) => { if (error) throw error; return data; };
    const EVENT_FIELDS = ['id', 'title', 'start_date', 'end_date', 'start_time', 'end_time', 'location', 'notes', 'repeat', 'repeat_until'];
    const TASK_FIELDS = ['id', 'title', 'event_id', 'assigned_to', 'due_date', 'done'];
    const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));

    return {
      demo: false,
      async init() {
        session = ok(await sb.auth.getSession()).session;
        sb.auth.onAuthStateChange((_evt, s) => {
          const before = email();
          session = s;
          if (email() !== before) onAuthChange();
        });
      },
      email,
      async signIn(addr) {
        ok(await sb.auth.signInWithOtp({ email: addr, options: { emailRedirectTo: location.origin + location.pathname } }));
      },
      async signOut() { await sb.auth.signOut(); session = null; },
      async ensureMember() {
        const find = async () => ok(await sb.from('members').select('*').eq('email', email()).maybeSingle());
        let me = await find();
        if (!me && ok(await sb.rpc('claim_admin'))) me = await find();
        return me;
      },
      async loadAll() {
        const [members, events, rsvps, tasks] = await Promise.all([
          sb.from('members').select('*').order('name'),
          sb.from('events').select('*').order('start_date'),
          sb.from('rsvps').select('*'),
          sb.from('tasks').select('*').order('created_at'),
        ].map((q) => q.then(ok)));
        return { members, events, rsvps, tasks };
      },
      async saveEvent(ev) {
        const row = pick(ev, EVENT_FIELDS);
        if (!row.id) delete row.id;
        return ok(await sb.from('events').upsert(row).select().single());
      },
      async deleteEvent(id) { ok(await sb.from('events').delete().eq('id', id)); },
      async setRsvp(event_id, on_date, status, note) {
        if (!status) { ok(await sb.from('rsvps').delete().eq('event_id', event_id).eq('email', email()).eq('on_date', on_date)); return; }
        ok(await sb.from('rsvps').upsert({ event_id, on_date, email: email(), status, note: note || null, updated_at: new Date().toISOString() }));
      },
      async saveTask(t) {
        const row = pick(t, TASK_FIELDS);
        if (!row.id) delete row.id;
        return ok(await sb.from('tasks').upsert(row).select().single());
      },
      async deleteTask(id) { ok(await sb.from('tasks').delete().eq('id', id)); },
      async addMember(m) {
        const { error } = await sb.from('members').insert({ email: m.email, name: m.name, color: m.color });
        if (error && error.code === '23505') throw new Error('That email is already on the family list.');
        if (error) throw error;
      },
      async updateMember(addr, patch) { ok(await sb.from('members').update(patch).eq('email', addr)); },
      async removeMember(addr) { ok(await sb.from('members').delete().eq('email', addr)); },
    };
  }

  // ---------- State ----------
  const state = {
    phase: 'loading', // loading | signin | sent | notmember | ready
    me: null,
    members: [], events: [], rsvps: [], tasks: [],
    month: today().slice(0, 8) + '01',
    selected: today(),
    taskFilter: 'todo',
    sentTo: '',
  };
  let store;

  const view = () => (location.hash.replace(/^#\/?/, '') || 'calendar').split('/')[0];
  const memberBy = (email) => state.members.find((m) => m.email === email);
  const eventBy = (id) => state.events.find((e) => e.id === id);
  const colorOf = (email) => (memberBy(email) || {}).color || COLORS[7];
  const nameOf = (email) => (memberBy(email) || {}).name || (email ? email.split('@')[0] : 'Someone');
  const avatar = (email, lg) => `<span class="avatar${lg ? ' lg' : ''}" style="background:${esc(colorOf(email))}" title="${esc(nameOf(email))}">${esc(initials(nameOf(email)))}</span>`;
  const sortEvents = (a, b) => a.start_date.localeCompare(b.start_date) || (a.start_time || '').localeCompare(b.start_time || '') || a.title.localeCompare(b.title);

  // ---- Repeating events ----
  // An event is stored once. Each date it happens on is an "occurrence": a copy of the
  // event with that date's start_date/end_date, plus `occ` (the date RSVPs are saved against).
  const REPEAT = { none: "Doesn't repeat", weekly: 'Every week', fortnightly: 'Every 2 weeks', monthly: 'Every month', yearly: 'Every year' };
  const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
  const spanOf = (e) => (e.end_date ? Math.max(0, daysBetween(e.start_date, e.end_date)) : 0);
  const repeats = (e) => !!e.repeat && e.repeat !== 'none';
  function isStart(e, iso) {
    if (iso < e.start_date) return false;
    if (!repeats(e)) return iso === e.start_date;
    if (e.repeat_until && iso > e.repeat_until) return false;
    const d = parse(iso), s = parse(e.start_date);
    switch (e.repeat) {
      case 'weekly': return daysBetween(e.start_date, iso) % 7 === 0;
      case 'fortnightly': return daysBetween(e.start_date, iso) % 14 === 0;
      case 'monthly': return d.getDate() === s.getDate();
      case 'yearly': return d.getDate() === s.getDate() && d.getMonth() === s.getMonth();
      default: return false;
    }
  }
  function occurrence(e, startIso) {
    const span = spanOf(e);
    return { ...e, start_date: startIso, end_date: span ? addDays(startIso, span) : null, occ: startIso };
  }
  function occurrenceOn(e, iso) {
    for (let k = 0, span = spanOf(e); k <= span; k++) { const s0 = addDays(iso, -k); if (isStart(e, s0)) return occurrence(e, s0); }
    return null;
  }
  // The occurrence happening on fromIso, or the next one after it.
  function nextOccurrence(e, fromIso) {
    const cur = occurrenceOn(e, fromIso);
    if (cur) return cur;
    if (!repeats(e)) return e.start_date > fromIso ? occurrence(e, e.start_date) : null;
    let d = fromIso > e.start_date ? fromIso : e.start_date;
    for (let i = 0; i < 800; i++) {
      if (e.repeat_until && d > e.repeat_until) return null;
      if (isStart(e, d)) return occurrence(e, d);
      d = addDays(d, 1);
    }
    return null;
  }
  const endOf = (e) => e.end_date || e.start_date;
  const eventsOn = (iso) => state.events.map((e) => occurrenceOn(e, iso)).filter(Boolean).sort(sortEvents);
  const rsvpDate = (r) => r.on_date || (eventBy(r.event_id) || {}).start_date;
  const rsvpsFor = (id, occ) => state.rsvps.filter((r) => r.event_id === id && rsvpDate(r) === occ);
  const myRsvp = (id, occ) => rsvpsFor(id, occ).find((r) => r.email === state.me.email);
  function repeatText(e) {
    if (!repeats(e)) return '';
    return REPEAT[e.repeat] + (e.repeat_until ? ` until ${fmtDate(e.repeat_until, { day: 'numeric', month: 'short', year: 'numeric' })}` : '');
  }

  // ---- Reminders: add to phone calendar (.ics) or Google Calendar ----
  const compact = (iso) => iso.replace(/-/g, '');
  const icsTime = (iso, t) => `${compact(iso)}T${hhmm(t).replace(':', '')}00`;
  function plusHour(t) { const [h, m] = hhmm(t).split(':').map(Number); return `${pad(Math.min(23, h + 1))}:${pad(h >= 23 ? 59 : m)}`; }
  function eventTimes(e) {
    // Returns [start, end] in calendar format. All-day events end the day after (calendar convention).
    if (!e.start_time) return { allDay: true, start: compact(e.start_date), end: compact(addDays(endOf(e), 1)) };
    return { allDay: false, start: icsTime(e.start_date, e.start_time), end: icsTime(endOf(e), e.end_time || plusHour(e.start_time)) };
  }
  function rrule(e) {
    if (!repeats(e)) return '';
    const freq = { weekly: 'FREQ=WEEKLY', fortnightly: 'FREQ=WEEKLY;INTERVAL=2', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY' }[e.repeat];
    return 'RRULE:' + freq + (e.repeat_until ? `;UNTIL=${compact(e.repeat_until)}${e.start_time ? 'T235959' : ''}` : '');
  }
  const icsText = (v) => String(v || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function buildIcs(e) {
    const t = eventTimes(e);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const url = location.origin + location.pathname;
    const lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Family Events//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${e.id}@family-events`,
      `DTSTAMP:${stamp}`,
      t.allDay ? `DTSTART;VALUE=DATE:${t.start}` : `DTSTART:${t.start}`,
      t.allDay ? `DTEND;VALUE=DATE:${t.end}` : `DTEND:${t.end}`,
      rrule(e),
      `SUMMARY:${icsText(e.title)}`,
      e.location ? `LOCATION:${icsText(e.location)}` : '',
      `DESCRIPTION:${icsText([e.notes, `RSVP: ${url}`].filter(Boolean).join('\n\n'))}`,
      `URL:${url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, t.allDay ? 'TRIGGER:-PT15H' : 'TRIGGER:-P1D', 'END:VALARM',
      t.allDay ? '' : ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsText(e.title)}`, 'TRIGGER:-PT2H', 'END:VALARM'].join('\r\n'),
      'END:VEVENT', 'END:VCALENDAR',
    ];
    return lines.filter(Boolean).join('\r\n') + '\r\n';
  }
  function downloadIcs(e) {
    if (!e) return;
    const blob = new Blob([buildIcs(e)], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${e.title.replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'event'}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast('Open the downloaded file to add it to your calendar');
  }
  function googleCalendarUrl(e) {
    const t = eventTimes(e);
    const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${t.start}/${t.end}`, details: [e.notes, `RSVP: ${location.origin + location.pathname}`].filter(Boolean).join('\n\n') });
    if (e.location) q.set('location', e.location);
    if (repeats(e)) q.set('recur', rrule(e));
    try { q.set('ctz', Intl.DateTimeFormat().resolvedOptions().timeZone); } catch (err) { /* older browsers */ }
    return `https://calendar.google.com/calendar/render?${q.toString()}`;
  }

  // ---- In-app reminders: what's on today/tomorrow and my tasks due soon ----
  function remindersCard() {
    const t = today(), tm = addDays(t, 1);
    const evs = [...eventsOn(t).map((e) => ({ e, when: 'Today' })), ...eventsOn(tm).filter((e) => e.start_date === tm).map((e) => ({ e, when: 'Tomorrow' }))];
    const tasks = state.tasks.filter((x) => !x.done && x.due_date && x.due_date <= tm && (x.assigned_to === state.me.email || !x.assigned_to))
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (!evs.length && !tasks.length) return '';
    const evRows = evs.map(({ e, when }) => {
      const mine = myRsvp(e.id, e.occ);
      return `<button class="rem" data-act="open-event" data-id="${esc(e.id)}" data-occ="${esc(e.occ)}">
        <span class="rem-when">${when}</span><span class="rem-what">${esc(e.title)}${e.start_time && e.start_date === (when === 'Today' ? t : tm) ? ` · ${esc(fmtTime(e.start_time))}` : ''}</span>
        ${mine ? `<span class="pill ${mine.status}">${esc(STATUS[mine.status].label)}</span>` : '<span class="pill warn">Reply</span>'}</button>`;
    }).join('');
    const taskRows = tasks.map((x) => `<button class="rem" data-act="edit-task" data-id="${esc(x.id)}">
        <span class="rem-when ${x.due_date < t ? 'overdue' : ''}">${x.due_date < t ? 'Overdue' : x.due_date === t ? 'Due today' : 'Due tomorrow'}</span><span class="rem-what">${esc(x.title)}</span></button>`).join('');
    return `<div class="reminders card"><div class="rem-head">🔔 Coming up</div>${evRows}${taskRows}</div>`;
  }

  function whenText(e) {
    const multi = e.end_date && e.end_date !== e.start_date;
    let s = fmtDate(e.start_date);
    if (multi) s += ` – ${fmtDate(e.end_date)}`;
    if (e.start_time) s += ` · ${fmtTime(e.start_time)}${e.end_time ? ` – ${fmtTime(e.end_time)}` : ''}`;
    else s += ' · All day';
    return s;
  }

  async function refresh() {
    if (state.phase !== 'ready') return;
    try {
      const data = await store.loadAll();
      Object.assign(state, data);
      const me = memberBy(state.me.email);
      if (!me) { state.phase = 'notmember'; closeSheet(); }
      else state.me = me;
      render();
      if (openSheet.current && openSheet.current.live) openSheet.current.rerender();
    } catch (e) { fail(e); }
  }

  async function start() {
    state.phase = 'loading';
    render();
    try {
      if (!store.email()) { state.phase = 'signin'; render(); return; }
      const me = await store.ensureMember();
      if (!me) { state.phase = 'notmember'; render(); return; }
      state.me = me;
      state.phase = 'ready';
      await refresh();
    } catch (e) {
      fail(e);
      state.phase = 'signin';
      render();
    }
  }

  // ---------- Rendering ----------
  function render() {
    const v = view();
    const ready = state.phase === 'ready';
    $('#family-name').textContent = CFG.familyName || 'Family Events';
    document.title = `${CFG.familyName || 'Family'} · Events`;
    $('#tabs').hidden = !ready;
    $('#fab').hidden = !ready || v === 'family';
    $('#fab').setAttribute('aria-label', v === 'tasks' ? 'Add a task' : 'Add an event');
    document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === v));
    $('#topbar-right').innerHTML = ready ? avatar(state.me.email) : '';
    $('#banner').innerHTML = store && store.demo && ready
      ? `<div class="banner"><span><b>Demo mode.</b> Sample data, saved only on this device.</span><button class="btn small" data-act="reset-demo">Reset demo</button></div>`
      : '';

    const el = $('#view');
    if (state.phase === 'loading') { el.innerHTML = '<p class="loading">Loading…</p>'; return; }
    if (state.phase === 'signin') { el.innerHTML = signInView(); return; }
    if (state.phase === 'sent') { el.innerHTML = sentView(); return; }
    if (state.phase === 'notmember') { el.innerHTML = notMemberView(); return; }
    el.innerHTML = ({ calendar: calendarView, upcoming: upcomingView, tasks: tasksView, family: familyView }[v] || calendarView)();
  }

  function signInView() {
    return `<div class="signin">
      <img src="icon.svg" alt="" width="72" height="72">
      <h1>${esc(CFG.familyName || 'Family Events')}</h1>
      <p>Our shared calendar, RSVPs and to-do lists.</p>
      <form class="card" data-form="signin">
        <label class="field"><span>Your email</span><input type="email" name="email" required autocomplete="email" placeholder="you@example.com"></label>
        <button class="btn primary block" type="submit">Email me a sign-in link</button>
        <p style="font-size:.85rem;margin:10px 0 0">No password needed. We'll email you a link that signs you in.</p>
      </form>
    </div>`;
  }
  function sentView() {
    return `<div class="signin"><div class="card" style="text-align:center">
      <div style="font-size:2.5rem">📬</div>
      <h2>Check your email</h2>
      <p>We sent a sign-in link to <b>${esc(state.sentTo)}</b>. Open it on this device to sign in.</p>
      <button class="btn" data-act="back-signin">Use a different email</button>
    </div></div>`;
  }
  function notMemberView() {
    return `<div class="signin"><div class="card" style="text-align:center">
      <div style="font-size:2.5rem">🔒</div>
      <h2>Almost there</h2>
      <p>You're signed in as <b>${esc(store.email())}</b>, but this email isn't on the family list yet.</p>
      <p>Ask whoever set up the app to add you in the <b>Family</b> tab, then try again.</p>
      <div class="sheet-actions" style="justify-content:center">
        <button class="btn primary" data-act="retry">Try again</button>
        <button class="btn" data-act="signout">Sign out</button>
      </div>
    </div></div>`;
  }

  function calendarView() {
    const first = parse(state.month);
    const y = first.getFullYear(), m = first.getMonth();
    const startOffset = (first.getDay() + 6) % 7; // weeks start on Monday
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const cells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
    const gridStart = addDays(state.month, -startOffset);
    const t = today();
    const dows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let grid = dows.map((d) => `<div class="dow">${d}</div>`).join('');
    for (let i = 0; i < cells; i++) {
      const iso = addDays(gridStart, i);
      const d = parse(iso);
      const evs = eventsOn(iso);
      const cls = ['day', d.getMonth() !== m && 'other', iso === t && 'today', iso === state.selected && 'sel'].filter(Boolean).join(' ');
      const dots = evs.slice(0, 4).map((e) => `<span class="dot" style="background:${esc(colorOf(e.created_by))}"></span>`).join('');
      const chips = evs.slice(0, 3).map((e) => `<span class="chip" style="background:${esc(colorOf(e.created_by))}">${e.start_time && e.start_date === iso ? esc(fmtTime(e.start_time)) + ' ' : ''}${esc(e.title)}</span>`).join('')
        + (evs.length > 3 ? `<span class="more">+${evs.length - 3} more</span>` : '');
      const label = `${fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}${evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}`;
      grid += `<button class="${cls}" data-act="pick-day" data-date="${iso}" aria-label="${esc(label)}"><span class="n">${d.getDate()}</span><span class="dots">${dots}</span><span class="chips">${chips}</span></button>`;
    }
    const dayEvents = eventsOn(state.selected);
    const monthName = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `
      ${remindersCard()}
      <div class="cal-head">
        <h2>${esc(monthName)}</h2>
        <div class="cal-nav">
          <button class="btn small" data-act="today">Today</button>
          <button class="iconbtn" data-act="month" data-dir="-1" aria-label="Previous month">‹</button>
          <button class="iconbtn" data-act="month" data-dir="1" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="cal">${grid}</div>
      <h3>${esc(fmtDate(state.selected, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3>
      ${dayEvents.length ? `<div class="list">${dayEvents.map(eventCard).join('')}</div>`
        : `<div class="empty">Nothing planned.<br><button class="btn small" style="margin-top:10px" data-act="new-event" data-date="${state.selected}">Add an event</button></div>`}
    `;
  }

  function rsvpPills(e) {
    const rs = rsvpsFor(e.id, e.occ);
    const count = (s) => rs.filter((r) => r.status === s).length;
    const mine = myRsvp(e.id, e.occ);
    let out = mine ? `<span class="pill ${mine.status}">You: ${esc(STATUS[mine.status].label)}</span>` : '<span class="pill warn">Reply needed</span>';
    if (count('going')) out += `<span class="pill">${count('going')} going</span>`;
    if (count('maybe')) out += `<span class="pill">${count('maybe')} maybe</span>`;
    const open = state.tasks.filter((t) => t.event_id === e.id && !t.done).length;
    if (open) out += `<span class="pill">${open} task${open > 1 ? 's' : ''} to do</span>`;
    if (repeats(e)) out += `<span class="pill" title="${esc(repeatText(e))}">🔁 ${esc(REPEAT[e.repeat])}</span>`;
    return out;
  }

  function eventCard(e) {
    return `<button class="ev" data-act="open-event" data-id="${esc(e.id)}" data-occ="${esc(e.occ)}">
      <span class="bar" style="background:${esc(colorOf(e.created_by))}"></span>
      <span class="ev-body">
        <span class="ev-title">${esc(e.title)}</span><br>
        <span class="ev-meta">${esc(whenText(e))}${e.location ? ` · ${esc(e.location)}` : ''}</span>
        <span class="ev-foot">${rsvpPills(e)}</span>
      </span>
    </button>`;
  }

  function upcomingView() {
    const t = today();
    const list = state.events.map((e) => nextOccurrence(e, t)).filter(Boolean).sort(sortEvents);
    const needReply = list.filter((e) => !myRsvp(e.id, e.occ)).length;
    if (!list.length) return `<h2>Upcoming</h2><div class="empty"><span class="big">🎈</span>No upcoming events yet.<br><button class="btn primary small" style="margin-top:12px" data-act="new-event">Plan something</button></div>`;
    let lastMonth = '';
    const items = list.map((e) => {
      const mo = parse(e.start_date).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      const head = mo !== lastMonth ? `<h3>${esc(mo)}</h3>` : '';
      lastMonth = mo;
      const d = parse(e.start_date);
      return `${head}<button class="ev" data-act="open-event" data-id="${esc(e.id)}" data-occ="${esc(e.occ)}">
        <span class="datebadge"><small>${esc(d.toLocaleDateString(undefined, { weekday: 'short' }))}</small><b>${d.getDate()}</b></span>
        <span class="ev-body">
          <span class="ev-title">${esc(e.title)}</span><br>
          <span class="ev-meta">${esc(whenText(e))}${e.location ? ` · ${esc(e.location)}` : ''}</span>
          <span class="ev-foot">${rsvpPills(e)}</span>
        </span>
      </button>`;
    }).join('');
    return `<h2>Upcoming</h2>
      ${needReply ? `<div class="banner"><span>👋 ${needReply} event${needReply > 1 ? 's need' : ' needs'} your RSVP.</span></div>` : ''}
      <div class="list">${items}</div>`;
  }

  function taskRow(t, showEvent = true) {
    const ev = t.event_id && eventBy(t.event_id);
    const overdue = !t.done && t.due_date && t.due_date < today();
    return `<div class="task${t.done ? ' done' : ''}">
      <input type="checkbox" data-act="toggle-task" data-id="${esc(t.id)}" ${t.done ? 'checked' : ''} aria-label="Mark “${esc(t.title)}” as done">
      <div class="t-body" data-act="edit-task" data-id="${esc(t.id)}" role="button" tabindex="0">
        <div class="t-title">${esc(t.title)}</div>
        <div class="t-meta">
          ${t.assigned_to ? `<span style="display:inline-flex;align-items:center;gap:4px">${avatar(t.assigned_to)}${esc(nameOf(t.assigned_to))}</span>` : '<span>Anyone</span>'}
          ${t.due_date ? `<span class="${overdue ? 'overdue' : ''}">Due ${esc(fmtDate(t.due_date))}</span>` : ''}
          ${showEvent && ev ? `<span>📅 ${esc(ev.title)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }

  function tasksView() {
    const f = state.taskFilter;
    let list = state.tasks.filter((t) => (f === 'done' ? t.done : !t.done));
    if (f === 'mine') list = list.filter((t) => t.assigned_to === state.me.email);
    list.sort((a, b) => (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.title.localeCompare(b.title));
    const seg = [['todo', 'To do'], ['mine', 'Mine'], ['done', 'Done']]
      .map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="task-filter" data-f="${k}">${l}</button>`).join('');
    const empty = { todo: 'All done! Nothing left to do.', mine: 'Nothing assigned to you.', done: 'No finished tasks yet.' }[f];
    return `<h2>Tasks</h2>
      <form class="quickadd" data-form="quick-task">
        <input type="text" name="title" placeholder="Add a task…" maxlength="300" aria-label="New task">
        <button class="btn primary" type="submit">Add</button>
      </form>
      <div class="seg" role="tablist">${seg}</div>
      ${list.length ? `<div class="tasks">${list.map((t) => taskRow(t)).join('')}</div>` : `<div class="empty"><span class="big">✨</span>${empty}</div>`}`;
  }

  function familyView() {
    const admin = state.me.is_admin;
    const members = [...state.members].sort((a, b) => a.name.localeCompare(b.name));
    const rows = members.map((m) => `<div class="member">
      ${avatar(m.email, true)}
      <div class="m-body"><b>${esc(m.name)}</b>${m.email === state.me.email ? ' <span class="pill">You</span>' : ''}${m.is_admin ? ' <span class="pill going">Admin</span>' : ''}
        <div class="m-email">${esc(m.email)}</div></div>
      ${admin && m.email !== state.me.email ? `<button class="iconbtn" data-act="remove-member" data-email="${esc(m.email)}" aria-label="Remove ${esc(m.name)}">✕</button>` : ''}
    </div>`).join('');
    const swatches = COLORS.map((c) => `<button type="button" class="swatch${c === state.me.color ? ' on' : ''}" style="background:${c}" data-act="my-color" data-color="${c}" aria-label="Colour ${c}"></button>`).join('');
    return `<h2>Family</h2>
      <div class="card">${rows}</div>
      ${admin ? `<h3>Add a family member</h3>
      <form class="card" data-form="add-member">
        <div class="row">
          <label class="field"><span>Name</span><input type="text" name="name" required maxlength="60" placeholder="Aunty Mere"></label>
          <label class="field"><span>Email</span><input type="email" name="email" required placeholder="mere@example.com"></label>
        </div>
        <button class="btn primary" type="submit">Add to family</button>
        <p style="font-size:.85rem;color:var(--muted);margin:10px 0 0">Then send them the link to this app. They sign in with this email.</p>
      </form>` : ''}
      <h3>Me</h3>
      <form class="card" data-form="me">
        <label class="field"><span>My name</span><input type="text" name="name" required maxlength="60" value="${esc(state.me.name)}"></label>
        <div class="field"><span style="display:block;font-size:.85rem;color:var(--muted);margin-bottom:6px;font-weight:600">My colour</span><div class="swatches">${swatches}</div></div>
        <div class="sheet-actions"><button class="btn primary" type="submit">Save</button><span class="spacer"></span>${store.demo ? '' : '<button class="btn" type="button" data-act="signout">Sign out</button>'}</div>
      </form>
      <h3>Put it on your home screen</h3>
      <div class="card" style="font-size:.92rem">
        <p style="margin-top:0"><b>iPhone:</b> open this page in Safari, tap the Share button, then <b>Add to Home Screen</b>.</p>
        <p style="margin-bottom:0"><b>Android:</b> open it in Chrome, tap the ⋮ menu, then <b>Add to Home screen</b>.</p>
      </div>`;
  }

  // ---------- Sheets (pop-up panels) ----------
  function openSheet(renderFn, onMount, live) {
    closeSheet(true);
    const root = $('#sheet-root');
    const lastFocus = document.activeElement;
    const s = {
      rerender() {
        const scroll = root.querySelector('.sheet') ? root.querySelector('.sheet').scrollTop : 0;
        const html = renderFn();
        if (html === null) { closeSheet(); return; }
        const anim = !s.shown ? ' anim' : '';
        s.shown = true;
        root.innerHTML = `<div class="backdrop${anim}" data-act="backdrop"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
        root.querySelector('.sheet').scrollTop = scroll;
        if (onMount) onMount(root);
      },
      lastFocus,
      live: !!live,
    };
    openSheet.current = s;
    s.rerender();
    const f = root.querySelector('[autofocus]') || root.querySelector('.sheet button, .sheet input');
    if (f) f.focus();
    document.body.style.overflow = 'hidden';
  }
  function closeSheet(silent) {
    const s = openSheet.current;
    $('#sheet-root').innerHTML = '';
    document.body.style.overflow = '';
    openSheet.current = null;
    if (s && s.onClose) s.onClose();
    if (!silent && s && s.lastFocus && document.contains(s.lastFocus)) s.lastFocus.focus();
  }
  // In-app confirmation (works everywhere, unlike the browser's confirm box).
  function askConfirm(message, okLabel) {
    return new Promise((resolve) => {
      let answered = false;
      const done = (v) => { if (answered) return; answered = true; closeSheet(); resolve(v); };
      openSheet(() => `${sheetHead('Are you sure?')}<p>${esc(message)}</p>
        <div class="sheet-actions"><button class="btn danger" data-confirm="yes">${esc(okLabel)}</button><button class="btn" data-confirm="no" autofocus>Cancel</button></div>`,
      (root) => {
        root.querySelectorAll('[data-confirm]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); done(b.dataset.confirm === 'yes'); }));
      });
      const s = openSheet.current;
      s.onClose = () => { if (!answered) { answered = true; resolve(false); } };
    });
  }
  const sheetHead = (title) => `<div class="sheet-head"><h2>${esc(title)}</h2><button class="iconbtn" data-act="close" aria-label="Close">✕</button></div>`;

  function openEvent(id, occ) {
    openSheet(() => {
      const series = eventBy(id);
      if (!series) return null;
      // Show the date that was tapped; fall back to the next date if the event has changed.
      if (!occ || !isStart(series, occ)) {
        const next = nextOccurrence(series, today()) || occurrence(series, series.start_date);
        occ = next.occ;
      }
      const e = occurrence(series, occ);
      const mine = myRsvp(id, occ);
      const rs = rsvpsFor(id, occ);
      const group = (s) => rs.filter((r) => r.status === s);
      const replied = new Set(rs.map((r) => r.email));
      const noReply = state.members.filter((m) => !replied.has(m.email));
      const peopleRow = (label, list, cls) => (list.length ? `<div class="who-row"><span class="lbl ${cls || ''}">${label}</span><div class="people">${list.map((r) =>
        `<span class="person">${avatar(r.email)}${esc(nameOf(r.email))}${r.note ? ` <em>“${esc(r.note)}”</em>` : ''}</span>`).join('')}</div></div>` : '');
      const tasks = state.tasks.filter((t) => t.event_id === id).sort((a, b) => a.done - b.done);
      const maps = e.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}` : '';
      return `${sheetHead(e.title)}
        <div class="detail-line"><span class="i">🗓️</span><span>${esc(whenText(e))}</span></div>
        ${repeats(e) ? `<div class="detail-line"><span class="i">🔁</span><span>${esc(repeatText(e))}</span></div>` : ''}
        ${e.location ? `<div class="detail-line"><span class="i">📍</span><a href="${maps}" target="_blank" rel="noopener">${esc(e.location)}</a></div>` : ''}
        <div class="detail-line"><span class="i">✍️</span><span>Added by ${esc(nameOf(e.created_by))}</span></div>
        ${e.notes ? `<div class="notes">${esc(e.notes)}</div>` : ''}

        <h3>Are you coming${repeats(e) ? ` on ${esc(fmtDate(occ, { weekday: 'long', day: 'numeric', month: 'short' }))}` : ''}?</h3>
        <div class="rsvp">${Object.entries(STATUS).map(([k, s]) =>
          `<button class="${k}${mine && mine.status === k ? ' on' : ''}" data-act="rsvp" data-id="${esc(id)}" data-occ="${esc(occ)}" data-status="${k}" aria-pressed="${mine && mine.status === k}"><span class="e">${s.emoji}</span>${esc(s.label)}</button>`).join('')}</div>
        ${mine ? `<form class="quickadd" data-form="rsvp-note" data-id="${esc(id)}" data-occ="${esc(occ)}" style="margin-top:10px">
          <input type="text" name="note" maxlength="300" placeholder="Add a note (optional), e.g. “Bringing dessert”" value="${esc(mine.note || '')}" aria-label="RSVP note">
          <button class="btn" type="submit">Save</button></form>` : ''}

        <h3>Who's coming</h3>
        <div class="who">
          ${peopleRow('👍 Going', group('going'))}
          ${peopleRow('🤔 Maybe', group('maybe'))}
          ${peopleRow("🙁 Can't go", group('no'))}
          ${noReply.length ? `<div class="who-row"><span class="lbl">⏳ No reply</span><div class="people">${noReply.map((m) => `<span class="person">${avatar(m.email)}${esc(m.name)}</span>`).join('')}</div></div>` : ''}
        </div>

        <h3>Reminders</h3>
        <p class="ev-meta" style="margin:0 0 8px">Add it to your phone's calendar to get an alert ${e.start_time ? 'the day before and 2 hours before' : 'at 9am the day before'}.${repeats(e) ? ' Every date is added.' : ''}</p>
        <div class="sheet-actions" style="margin-top:0">
          <button class="btn" data-act="add-calendar" data-id="${esc(id)}">📅 Add to my calendar</button>
          <a class="btn" href="${esc(googleCalendarUrl(series))}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit;display:inline-flex;align-items:center">Google Calendar</a>
        </div>

        <h3>Tasks for this event</h3>
        <form class="quickadd" data-form="event-task" data-id="${esc(id)}">
          <input type="text" name="title" placeholder="e.g. Bring chairs" maxlength="300" aria-label="New task for this event">
          <button class="btn primary" type="submit">Add</button>
        </form>
        <div class="tasks">${tasks.length ? tasks.map((t) => taskRow(t, false)).join('') : '<div class="ev-meta">No tasks yet.</div>'}</div>

        <div class="sheet-actions">
          <button class="btn" data-act="edit-event" data-id="${esc(id)}">Edit</button>
          <button class="btn" data-act="copy-event" data-id="${esc(id)}" data-occ="${esc(occ)}">Share</button>
          <span class="spacer"></span>
          <button class="btn danger" data-act="delete-event" data-id="${esc(id)}">Delete</button>
        </div>`;
    }, null, true);
  }

  function openEventForm(id, date) {
    const e = id ? eventBy(id) : { title: '', start_date: date || state.selected || today(), end_date: null, start_time: '', end_time: '', location: '', notes: '', repeat: 'none', repeat_until: null };
    const rep = e.repeat || 'none';
    const allDay = id ? !e.start_time : false;
    openSheet(() => `${sheetHead(id ? 'Edit event' : 'New event')}
      <form data-form="event" data-id="${esc(id || '')}">
        <label class="field"><span>What's happening?</span><input type="text" name="title" required maxlength="200" value="${esc(e.title)}" placeholder="e.g. Sunday roast" autofocus></label>
        <div class="row">
          <label class="field"><span>Date</span><input type="date" name="start_date" required value="${esc(e.start_date)}"></label>
          <label class="field"><span>Ends (if more than one day)</span><input type="date" name="end_date" value="${esc(e.end_date || '')}"></label>
        </div>
        <label class="check"><input type="checkbox" name="all_day" ${allDay ? 'checked' : ''}> All day</label>
        <div class="row" data-times ${allDay ? 'hidden' : ''}>
          <label class="field"><span>Starts</span><input type="time" name="start_time" value="${esc(hhmm(e.start_time) || (id ? '' : '12:00'))}"></label>
          <label class="field"><span>Ends (optional)</span><input type="time" name="end_time" value="${esc(hhmm(e.end_time))}"></label>
        </div>
        <div class="row">
          <label class="field"><span>Repeats</span><select name="repeat">${Object.entries(REPEAT).map(([k, l]) => `<option value="${k}" ${k === rep ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <label class="field" data-until ${rep === 'none' ? 'hidden' : ''}><span>Until (optional)</span><input type="date" name="repeat_until" value="${esc(e.repeat_until || '')}"></label>
        </div>
        ${id && rep !== 'none' ? '<p class="ev-meta" style="margin:-4px 0 12px">Changes apply to every date of this repeating event.</p>' : ''}
        <label class="field"><span>Where (optional)</span><input type="text" name="location" maxlength="300" value="${esc(e.location || '')}" placeholder="Address or place"></label>
        <label class="field"><span>Notes (optional)</span><textarea name="notes" maxlength="5000" placeholder="What to bring, parking, dress code…">${esc(e.notes || '')}</textarea></label>
        <div class="sheet-actions"><button class="btn primary" type="submit">${id ? 'Save changes' : 'Add event'}</button><button class="btn" type="button" data-act="${id ? 'open-event' : 'close'}" data-id="${esc(id || '')}">Cancel</button></div>
      </form>`, (root) => {
      const cb = root.querySelector('[name=all_day]');
      cb.addEventListener('change', () => { root.querySelector('[data-times]').hidden = cb.checked; });
      const rs = root.querySelector('[name=repeat]');
      rs.addEventListener('change', () => { root.querySelector('[data-until]').hidden = rs.value === 'none'; });
    });
  }

  function openTaskForm(id, preset) {
    const t = id ? state.tasks.find((x) => x.id === id) : { title: '', assigned_to: null, due_date: null, event_id: null, ...preset };
    if (!t) return;
    const upcoming = state.events.map((e) => nextOccurrence(e, today()) || (e.id === t.event_id ? occurrence(e, e.start_date) : null)).filter(Boolean).sort(sortEvents);
    openSheet(() => `${sheetHead(id ? 'Edit task' : 'New task')}
      <form data-form="task" data-id="${esc(id || '')}">
        <label class="field"><span>Task</span><input type="text" name="title" required maxlength="300" value="${esc(t.title)}" placeholder="e.g. Pick up Nana" autofocus></label>
        <div class="row">
          <label class="field"><span>Who's doing it?</span><select name="assigned_to"><option value="">Anyone</option>${[...state.members].sort((a, b) => a.name.localeCompare(b.name)).map((m) =>
            `<option value="${esc(m.email)}" ${m.email === t.assigned_to ? 'selected' : ''}>${esc(m.name)}${m.email === state.me.email ? ' (me)' : ''}</option>`).join('')}</select></label>
          <label class="field"><span>Due (optional)</span><input type="date" name="due_date" value="${esc(t.due_date || '')}"></label>
        </div>
        <label class="field"><span>For an event? (optional)</span><select name="event_id"><option value="">No event</option>${upcoming.map((e) =>
          `<option value="${esc(e.id)}" ${e.id === t.event_id ? 'selected' : ''}>${esc(e.title)} · ${esc(fmtDate(e.start_date))}</option>`).join('')}</select></label>
        <div class="sheet-actions"><button class="btn primary" type="submit">${id ? 'Save' : 'Add task'}</button><button class="btn" type="button" data-act="close">Cancel</button>
          <span class="spacer"></span>${id ? `<button class="btn danger" type="button" data-act="delete-task" data-id="${esc(id)}">Delete</button>` : ''}</div>
      </form>`);
  }

  // ---------- Actions ----------
  async function run(fn, okMsg) {
    try { await fn(); if (okMsg) toast(okMsg); await refresh(); } catch (e) { fail(e); }
  }

  const actions = {
    'pick-day': (el) => { state.selected = el.dataset.date; if (state.selected.slice(0, 8) + '01' !== state.month) state.month = state.selected.slice(0, 8) + '01'; render(); },
    month: (el) => { const d = parse(state.month); d.setMonth(d.getMonth() + Number(el.dataset.dir)); state.month = toISO(d); render(); },
    today: () => { state.selected = today(); state.month = today().slice(0, 8) + '01'; render(); },
    'open-event': (el) => openEvent(el.dataset.id, el.dataset.occ),
    'new-event': (el) => openEventForm(null, el.dataset.date),
    'edit-event': (el) => openEventForm(el.dataset.id),
    'delete-event': async (el) => {
      const e = eventBy(el.dataset.id);
      if (!e) return;
      const msg = repeats(e)
        ? `Delete “${e.title}”? This repeats ${REPEAT[e.repeat].toLowerCase()}, and every date will be deleted, with all RSVPs and tasks.`
        : `Delete “${e.title}”? Its RSVPs and tasks will be deleted too.`;
      if (!(await askConfirm(msg, 'Delete event'))) return;
      run(() => store.deleteEvent(e.id), 'Event deleted');
    },
    'copy-event': async (el) => {
      const series = eventBy(el.dataset.id);
      const e = el.dataset.occ ? occurrence(series, el.dataset.occ) : series;
      const text = `${e.title}\n${whenText(e)}${repeats(e) ? `\n${repeatText(e)}` : ''}${e.location ? `\n${e.location}` : ''}\nRSVP here: ${location.origin + location.pathname}`;
      try {
        if (navigator.share) { await navigator.share({ title: e.title, text }); return; }
      } catch (err) { if (err && err.name === 'AbortError') return; }
      try { await navigator.clipboard.writeText(text); toast('Copied. Paste it into a message to the family.'); }
      catch (err) { toast('Could not copy automatically on this device.', true); }
    },
    'add-calendar': (el) => downloadIcs(eventBy(el.dataset.id)),
    rsvp: (el) => {
      const id = el.dataset.id, occ = el.dataset.occ, status = el.dataset.status;
      const mine = myRsvp(id, occ);
      const next = mine && mine.status === status ? null : status;
      run(() => store.setRsvp(id, occ, next, mine ? mine.note : null), next ? `RSVP saved: ${STATUS[next].label}` : 'RSVP cleared');
    },
    'toggle-task': (el) => {
      const t = state.tasks.find((x) => x.id === el.dataset.id);
      if (t) run(() => store.saveTask({ ...t, done: el.checked }), el.checked ? 'Nice work! ✅' : null);
    },
    'edit-task': (el) => openTaskForm(el.dataset.id),
    'delete-task': (el) => { closeSheet(true); run(() => store.deleteTask(el.dataset.id), 'Task deleted'); },
    'task-filter': (el) => { state.taskFilter = el.dataset.f; render(); },
    'remove-member': async (el) => {
      const m = memberBy(el.dataset.email);
      if (m && (await askConfirm(`Remove ${m.name} from the family? They won't be able to see events any more.`, 'Remove'))) run(() => store.removeMember(m.email), `${m.name} removed`);
    },
    'my-color': (el) => run(() => store.updateMember(state.me.email, { color: el.dataset.color }), 'Colour updated'),
    signout: async () => { await store.signOut(); state.me = null; state.phase = 'signin'; render(); },
    retry: () => start(),
    'back-signin': () => { state.phase = 'signin'; render(); },
    'reset-demo': async () => { if (await askConfirm('Reset the demo back to the sample data? Anything you added will be cleared.', 'Reset demo')) { await store.signOut(); start(); } },
    close: () => closeSheet(),
    backdrop: (el, ev) => { if (ev.target === el) closeSheet(); },
  };

  const forms = {
    signin: async (f) => {
      const email = f.email.value.trim().toLowerCase();
      const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Sending…';
      try { await store.signIn(email); state.sentTo = email; state.phase = 'sent'; render(); } catch (e) { fail(e); btn.disabled = false; btn.textContent = 'Email me a sign-in link'; }
    },
    event: (f) => {
      const allDay = f.all_day.checked;
      const ev = {
        id: f.dataset.id || undefined,
        title: f.title.value.trim(),
        start_date: f.start_date.value,
        end_date: clean(f.end_date.value),
        start_time: allDay ? null : clean(f.start_time.value),
        end_time: allDay ? null : clean(f.end_time.value),
        location: clean(f.location.value),
        notes: clean(f.notes.value),
        repeat: f.repeat.value,
        repeat_until: f.repeat.value === 'none' ? null : clean(f.repeat_until.value),
      };
      if (!ev.title) return toast('Please give the event a name', true);
      if (ev.repeat_until && ev.repeat_until < ev.start_date) return toast('The "until" date is before the first date', true);
      if (ev.end_date && ev.end_date < ev.start_date) return toast('The end date is before the start date', true);
      if (ev.end_date === ev.start_date) ev.end_date = null;
      if (!ev.start_time) ev.end_time = null;
      run(async () => {
        const saved = await store.saveEvent(ev);
        state.selected = saved.start_date;
        state.month = saved.start_date.slice(0, 8) + '01';
        await refresh();
        openEvent(saved.id, saved.start_date);
      }, ev.id ? 'Event updated' : 'Event added');
    },
    task: (f) => {
      const t = {
        ...(f.dataset.id ? state.tasks.find((x) => x.id === f.dataset.id) : {}),
        id: f.dataset.id || undefined,
        title: f.title.value.trim(),
        assigned_to: clean(f.assigned_to.value),
        due_date: clean(f.due_date.value),
        event_id: clean(f.event_id.value),
      };
      if (!t.title) return toast('Please describe the task', true);
      closeSheet();
      run(() => store.saveTask(t), f.dataset.id ? 'Task updated' : 'Task added');
    },
    'quick-task': (f) => {
      const title = f.title.value.trim();
      if (!title) return;
      run(() => store.saveTask({ title, assigned_to: state.taskFilter === 'mine' ? state.me.email : null, event_id: null, due_date: null, done: false }), 'Task added');
    },
    'event-task': (f) => {
      const title = f.title.value.trim();
      if (!title) return;
      run(() => store.saveTask({ title, event_id: f.dataset.id, assigned_to: null, due_date: null, done: false }), 'Task added');
    },
    'rsvp-note': (f) => {
      const mine = myRsvp(f.dataset.id, f.dataset.occ);
      if (mine) run(() => store.setRsvp(f.dataset.id, f.dataset.occ, mine.status, clean(f.note.value)), 'Note saved');
    },
    'add-member': (f) => {
      const email = f.email.value.trim().toLowerCase();
      const name = f.name.value.trim();
      const used = new Set(state.members.map((m) => m.color));
      const color = COLORS.find((c) => !used.has(c)) || COLORS[state.members.length % COLORS.length];
      run(() => store.addMember({ email, name, color }), `${name} added to the family`);
    },
    me: (f) => {
      const name = f.name.value.trim();
      if (name) run(() => store.updateMember(state.me.email, { name }), 'Saved');
    },
  };

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT') return;
    const fn = actions[el.dataset.act];
    if (fn) { if (el.tagName === 'A') ev.preventDefault(); fn(el, ev); }
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.matches('input[type=checkbox][data-act]')) actions[el.dataset.act](el, ev);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && openSheet.current) closeSheet();
    if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.matches('[role=button][data-act]')) { ev.preventDefault(); ev.target.click(); }
  });
  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('form[data-form]');
    if (!f) return;
    ev.preventDefault();
    const fn = forms[f.dataset.form];
    if (fn) fn(f);
  });
  $('#fab').addEventListener('click', () => (view() === 'tasks' ? openTaskForm(null, state.taskFilter === 'mine' ? { assigned_to: state.me.email } : {}) : openEventForm(null)));
  window.addEventListener('hashchange', () => { closeSheet(true); render(); window.scrollTo(0, 0); });

  // Keep everyone's view fresh without needing to reload.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  setInterval(() => { if (!document.hidden && !openSheet.current) refresh(); }, 60000);

  // ---------- Start ----------
  (async () => {
    try {
      if (!DEMO && !window.supabase) throw new Error('Could not load the sign-in library. Check your internet connection.');
      store = DEMO ? makeDemoStore() : makeSupabaseStore(() => start());
      await store.init();
      await start();
    } catch (e) {
      fail(e);
      $('#view').innerHTML = `<div class="empty"><span class="big">😕</span>${esc(e.message || 'The app could not start.')}<br><button class="btn" style="margin-top:12px" onclick="location.reload()">Reload</button></div>`;
    }
  })();
})();
