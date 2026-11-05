/**
 * Prototype of the day/week planning engine (concept `docs/design/plan/CONCEPT.md` §3).
 * Pure, deterministic, dependency-free. Run: `node docs/design/plan/engine-proto.mjs`.
 * Not app code: the real engine lives in `web/src/core/plan/` (package 1) with the same contract.
 *
 * Input:  days (date, availableMin, blockers), items (duration, prio, due, earliest, pinned,
 *         splittable, createdAt), previous assignments, settings.
 * Output: assignments (unit → day, order, minutes, reason), unplaced (with reason), diff to the
 *         previous assignments, load per day and the overflow of the horizon.
 */

// ---------- dates (YYYY-MM-DD, no Date.now) ----------
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const toStr = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) =>
  toStr(new Date(toDate(s).getTime() + n * 86_400_000));
export const daysBetween = (a, b) =>
  Math.round((toDate(b) - toDate(a)) / 86_400_000);
const weekday = (s) =>
  ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"][toDate(s).getUTCDay()];

export const DEFAULTS = {
  bufferShare: 0.2, // never planned: 20 % of the free time
  maxSessionMin: 90, // longer items are cut into sessions
  minSessionMin: 25,
  mainPerDay: 3, // "Drei Dinge reichen" – main items (≥ mainThresholdMin) per day
  mainThresholdMin: 30,
  horizonDays: 14,
};

// ---------- capacity ----------
export function capacity(day, s) {
  const blocked = day.blockers.reduce((n, b) => n + b.min, 0);
  const raw = Math.max(0, day.availableMin - blocked);
  return { raw, usable: Math.floor(raw * (1 - s.bufferShare)), blocked };
}

// ---------- units: an item becomes 1..n sessions ----------
export function toUnits(item, s) {
  if (!item.splittable || item.min <= s.maxSessionMin)
    return [
      { id: `${item.id}#1`, itemId: item.id, k: 0, of: 1, min: item.min, item },
    ];
  const of = Math.ceil(item.min / s.maxSessionMin);
  const per = Math.max(s.minSessionMin, Math.ceil(item.min / of));
  return Array.from({ length: of }, (_, k) => ({
    id: `${item.id}#${k + 1}`,
    itemId: item.id,
    k,
    of,
    min: k === of - 1 ? item.min - per * (of - 1) : per,
    item,
  }));
}

/**
 * Last day a unit may start so that it and the remaining sessions (one per day) still meet a hard
 * due. Counts only days that have room (a free Thursday does not count), using the raw free time:
 * a deadline may eat the buffer.
 */
function latestStart(u, horizon, s) {
  if (!u.item.due?.hard) return undefined;
  // A due beyond the horizon is no pressure inside it (otherwise far invoices would be forced onto
  // the last day and move again on every run).
  if (horizon.length === 0 || u.item.due.date > horizon.at(-1).date)
    return undefined;
  const first = horizon[0].date;
  const room = (date) => {
    const d = horizon.find((x) => x.date === date);
    return d ? capacity(d, s).raw >= u.min : false;
  };
  let cursor = u.item.due.date;
  for (let j = u.of - 1; j >= u.k; j--) {
    let d = cursor;
    while (d >= first && !room(d)) d = addDays(d, -1);
    if (j === u.k) return d; // may lie before today: then it is "now or late"
    cursor = addDays(d, -1);
  }
  return cursor;
}

// ---------- the plan ----------
export function plan({ today, days, items, prev = [], settings = {} }) {
  const s = { ...DEFAULTS, ...settings };
  const horizon = days
    .filter((d) => d.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  const prevByUnit = new Map(prev.map((a) => [a.unitId, a]));
  const units = items.filter((i) => !i.done).flatMap((i) => toUnits(i, s));
  const placed = new Map(); // unitId → assignment
  const assignments = [];
  const load = {};
  const bumps = []; // {unitId, day, by}

  for (const day of horizon) {
    const cap = capacity(day, s);
    let left = cap.usable;
    let rawLeft = cap.raw;
    let mains = 0;
    const todayList = [];
    const isMain = (u) => u.item.min >= s.mainThresholdMin;
    const put = (u, reason, extra = {}) => {
      const a = {
        unitId: u.id,
        itemId: u.itemId,
        date: day.date,
        min: u.min,
        order: todayList.length,
        reason,
        ...extra,
      };
      placed.set(u.id, a);
      assignments.push(a);
      todayList.push(a);
      left -= u.min;
      rawLeft -= u.min;
      if (isMain(u)) mains++;
    };
    // `sameDay`: a second session of one item on the same day is allowed only under deadline pressure.
    const eligible = (u, sameDay = false) =>
      !placed.has(u.id) &&
      (!u.item.earliest || u.item.earliest <= day.date) &&
      (u.k === 0 ||
        (sameDay
          ? (placed.get(`${u.itemId}#${u.k}`)?.date ?? "9999") <= day.date
          : (placed.get(`${u.itemId}#${u.k}`)?.date ?? "9999") < day.date));

    // 1. pinned: the user nailed the item to this day; capacity is not asked (overload is counted).
    for (const u of units.filter(
      (u) => u.item.pinned === day.date && eligible(u),
    ))
      put(u, "pinned");

    // 2. must start today to meet a hard due (deadline before priority); may eat the buffer and may
    //    place a second session of the same item on this day (a pass per session).
    const must = [];
    for (let pass = 0; pass < 8; pass++) {
      const batch = units
        .filter((u) => eligible(u, true) && !must.includes(u))
        .map((u) => [u, latestStart(u, horizon, s)])
        .filter(([, ls]) => ls !== undefined && ls <= day.date)
        .sort(
          ([a, la], [b, lb]) =>
            cmp(la, lb) ||
            cmp(a.item.due.date, b.item.due.date) ||
            b.item.prio - a.item.prio ||
            cmp(a.id, b.id),
        );
      if (batch.length === 0) break;
      let any = false;
      for (const [u] of batch) {
        must.push(u);
        if (u.min <= left) {
          put(u, "deadline");
          any = true;
        } else if (u.min <= rawLeft) {
          put(u, "deadline-buffer");
          any = true;
        }
        // else: stays in the pool; after its due it is reported as late (see below)
      }
      if (!any) break;
    }

    // 3. everything else: priority, then what was already planned for this day, then soft due, age.
    // 2 = was planned for this day (kept), 1 = planned for an earlier day (carried), 0 = new.
    const sticky = (u) => {
      const p = prevByUnit.get(u.id);
      return !p || p.date > day.date ? 0 : p.date === day.date ? 2 : 1;
    };
    const rest = units
      .filter((u) => eligible(u) && !must.includes(u))
      .sort(
        (a, b) =>
          b.item.prio - a.item.prio ||
          sticky(b) - sticky(a) ||
          cmp(a.item.due?.date ?? "9999", b.item.due?.date ?? "9999") ||
          a.item.createdAt - b.item.createdAt ||
          cmp(a.id, b.id),
      );
    for (const u of rest) {
      if (u.min > left) continue;
      if (isMain(u) && mains >= s.mainPerDay) continue;
      const p = prevByUnit.get(u.id);
      const reason = !p
        ? "new"
        : p.date === day.date
          ? "kept"
          : p.date < day.date
            ? "carried"
            : "pulled";
      put(u, reason);
    }
    // what was planned for today before and did not get a place: who took it?
    for (const u of units) {
      const p = prevByUnit.get(u.id);
      if (p && p.date === day.date && !placed.has(u.id)) {
        // Who took the room: every unit placed today that was not planned for today before, largest first.
        const by = todayList
          .filter((a) => prevByUnit.get(a.unitId)?.date !== day.date)
          .sort((a, b) => b.min - a.min || cmp(a.unitId, b.unitId))
          .map((a) => a.unitId);
        bumps.push({
          unitId: u.id,
          day: day.date,
          by,
          cause: by.length ? "bumped" : "capacity",
        });
      }
    }
    load[day.date] = {
      usable: cap.usable,
      raw: cap.raw,
      planned: todayList.reduce((n, a) => n + a.min, 0),
      over: Math.max(0, todayList.reduce((n, a) => n + a.min, 0) - cap.usable),
      mains,
    };
  }

  // late and unplaced
  const unplaced = [];
  for (const u of units) {
    const a = placed.get(u.id);
    const ls = latestStart(u, horizon, s);
    if (a && u.item.due?.hard && a.date > u.item.due.date) {
      a.late = true;
      unplaced.push({
        unitId: u.id,
        reason: "after-hard-due",
        date: a.date,
        due: u.item.due.date,
      });
    } else if (!a) {
      const fits = horizon.some((d) => u.min <= capacity(d, s).usable);
      unplaced.push({
        unitId: u.id,
        reason: !fits
          ? "too-long"
          : ls !== undefined && ls < horizon.at(-1).date
            ? "after-hard-due"
            : "horizon",
        min: u.min,
      });
    }
  }

  // diff against the previous assignments
  const diff = { added: [], removed: [], moved: [], unchanged: 0 };
  for (const a of assignments) {
    const p = prevByUnit.get(a.unitId);
    if (!p) diff.added.push({ unitId: a.unitId, to: a.date, reason: a.reason });
    else if (p.date === a.date) diff.unchanged++;
    else {
      const b = bumps.find((x) => x.unitId === a.unitId);
      diff.moved.push({
        unitId: a.unitId,
        from: p.date,
        to: a.date,
        reason: b?.cause ?? (a.date < p.date ? "pulled" : "carried"),
        by: b?.by,
      });
    }
  }
  for (const p of prev)
    if (!placed.has(p.unitId)) {
      const b = bumps.find((x) => x.unitId === p.unitId);
      const still = units.some((u) => u.id === p.unitId);
      diff.removed.push({
        unitId: p.unitId,
        from: p.date,
        reason: still ? (b?.cause ?? "capacity") : "done",
        by: b?.by,
      });
    }

  const demand = units.reduce((n, u) => n + u.min, 0);
  const usableTotal = Object.values(load).reduce((n, l) => n + l.usable, 0);
  return {
    assignments,
    unplaced,
    diff,
    load,
    overflowMin: Math.max(0, demand - usableTotal),
    demandMin: demand,
    usableMin: usableTotal,
  };
}

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// ---------- printing ----------
const REASON = {
  pinned: "festgenagelt",
  deadline: "muss bis zur Frist fertig sein",
  "deadline-buffer": "Frist – nutzt den Puffer",
  new: "neu, nach Priorität",
  kept: "wie geplant",
  carried: "weiter von früher",
  pulled: "vorgezogen",
};
const fmt = (min) =>
  min >= 60
    ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60}` : ""}`
    : `${min} Min`;

export function print(title, input, result) {
  const titles = new Map(input.items.map((i) => [i.id, i.title]));
  const name = (unitId) => {
    const [id, k] = unitId.split("#");
    const u = result.assignments.find((a) => a.unitId === unitId);
    const of = input.items.find((i) => i.id === id);
    const parts = of && toUnits(of, { ...DEFAULTS, ...input.settings }).length;
    return `${titles.get(id)}${parts > 1 ? ` (${k}/${parts})` : ""}`;
  };
  console.log(
    `\n=== ${title} (heute ${weekday(input.today)} ${input.today}) ===`,
  );
  for (const [date, l] of Object.entries(result.load)) {
    const day = input.days.find((d) => d.date === date);
    const blockers = day.blockers
      .map((b) => `${b.label} ${fmt(b.min)}`)
      .join(", ");
    console.log(
      `${weekday(date)} ${date} · frei ${fmt(l.raw)} (${fmt(l.usable)} planbar)${blockers ? ` · Blocker: ${blockers}` : ""} · geplant ${fmt(l.planned)}${l.over ? ` · ${fmt(l.over)} über dem Puffer` : ""}`,
    );
    for (const a of result.assignments.filter((a) => a.date === date))
      console.log(
        `   ${String(a.order + 1).padStart(2)}. ${name(a.unitId).padEnd(32)} ${fmt(a.min).padStart(7)}   ${REASON[a.reason]}${a.late ? " · NACH DER FRIST" : ""}`,
      );
  }
  if (result.unplaced.length) {
    console.log("Nicht unterbringbar:");
    for (const u of result.unplaced)
      console.log(
        `   ${name(u.unitId)} – ${u.reason}${u.due ? ` (Frist ${u.due}, geplant ${u.date})` : ""}`,
      );
  }
  const d = result.diff;
  console.log(
    `Diff: ${d.added.length} neu · ${d.moved.length} verschoben · ${d.removed.length} weg · ${d.unchanged} unverändert`,
  );
  const who = (by) =>
    by?.length ? ` durch ${by.map((id) => `„${name(id)}“`).join(", ")}` : "";
  for (const m of d.moved)
    console.log(
      `   ${name(m.unitId)}: ${m.from} → ${m.to} (${m.reason}${who(m.by)})`,
    );
  for (const r of d.removed)
    console.log(
      `   ${name(r.unitId)}: ${r.reason === "done" ? "erledigt" : `wartet (${r.reason}${who(r.by)})`}`,
    );
  console.log(
    `Bedarf ${fmt(result.demandMin)} · planbar ${fmt(result.usableMin)}${result.overflowMin ? ` · ${fmt(result.overflowMin)} mehr zu tun als frei` : " · passt"}`,
  );
}

// ---------- scenarios ----------
const week = (
  from,
  n,
  avail = { Mo: 240, Di: 240, Mi: 240, Do: 240, Fr: 240, Sa: 120, So: 0 },
) =>
  Array.from({ length: n }, (_, i) => {
    const date = addDays(from, i);
    return { date, availableMin: avail[weekday(date)], blockers: [] };
  });
const block = (days, date, label, min) =>
  days.find((d) => d.date === date).blockers.push({ label, min });

const MON = "2026-11-09";
const ITEMS = [
  {
    id: "a",
    title: "Steuererklärung",
    min: 120,
    prio: 2,
    due: { date: "2026-11-12", hard: true },
    splittable: true,
    createdAt: 1,
  },
  {
    id: "b",
    title: "Rechnung Strom zahlen",
    min: 10,
    prio: 1,
    due: { date: "2026-11-11", hard: true },
    createdAt: 2,
  },
  { id: "c", title: "Angebot vergleichen", min: 45, prio: 3, createdAt: 3 },
  {
    id: "d",
    title: "Keller aufräumen",
    min: 180,
    prio: 0,
    splittable: true,
    createdAt: 4,
  },
  {
    id: "e",
    title: "Geschenk bestellen",
    min: 20,
    prio: 2,
    due: { date: "2026-11-13", hard: false },
    createdAt: 5,
  },
  { id: "f", title: "Blogpost schreiben", min: 90, prio: 1, createdAt: 6 },
  { id: "g", title: "Arzttermin vereinbaren", min: 10, prio: 2, createdAt: 7 },
  {
    id: "h",
    title: "Fahrrad reparieren",
    min: 60,
    prio: 1,
    earliest: "2026-11-14",
    createdAt: 8,
  },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  // S1 – Wochenstart Montag: 8 Dinge, zwei Termine als Blocker.
  const days1 = week(MON, 7);
  block(days1, "2026-11-10", "Zahnarzt", 60);
  block(days1, "2026-11-12", "Teamrunde", 90);
  const in1 = { today: MON, days: days1, items: ITEMS };
  const r1 = plan(in1);
  print("S1 Wochenstart", in1, r1);

  // S2 – Dienstag: „Angebot vergleichen“ erledigt, neuer Eintrag mit Prio 3 und harter Frist Freitag.
  const items2 = ITEMS.map((i) =>
    i.id === "c" ? { ...i, done: true } : i,
  ).concat({
    id: "i",
    title: "Vortrag vorbereiten",
    min: 90,
    prio: 3,
    due: { date: "2026-11-13", hard: true },
    createdAt: 9,
  });
  const in2 = {
    today: "2026-11-10",
    days: days1,
    items: items2,
    prev: r1.assignments,
  };
  const r2 = plan(in2);
  print("S2 Neuer Eintrag mit Prio", in2, r2);

  // S3 – Mittwoch: „Donnerstag frei“ und ein Ding, das bis Donnerstag fertig sein müsste.
  const days3 = days1.map((d) =>
    d.date === "2026-11-12"
      ? { ...d, availableMin: 0, blockers: [{ label: "frei", min: 0 }] }
      : d,
  );
  const items3 = items2.concat({
    id: "j",
    title: "Steuerbescheid prüfen",
    min: 60,
    prio: 2,
    due: { date: "2026-11-12", hard: true },
    createdAt: 10,
  });
  const in3 = {
    today: "2026-11-11",
    days: days3,
    items: items3,
    prev: r2.assignments,
  };
  const r3 = plan(in3);
  print("S3 Donnerstag frei + Überlast", in3, r3);

  // S4 – Ferne Frist: ein Ding mit harter Frist weit hinter dem Horizont wird nicht erzwungen.
  const in4 = {
    today: MON,
    days: days1,
    items: ITEMS.concat({
      id: "k",
      title: "Jahresabschluss",
      min: 60,
      prio: 0,
      due: { date: "2026-12-20", hard: true },
      createdAt: 11,
    }),
  };
  const r4 = plan(in4);
  const far =
    r4.assignments.find((a) => a.itemId === "k") ??
    r4.unplaced.find((u) => u.unitId === "k#1");
  console.log(
    `\n=== S4 Ferne Frist (heute Mo ${MON}) ===\nJahresabschluss (Frist 2026-12-20): ${far?.reason === "deadline" ? "FEHLER – als Frist erzwungen" : `${far?.date ?? "wartet"} · ${REASON[far?.reason] ?? far?.reason}`}`,
  );
}
