/**
 * Security Event Detection & Investigation Lab — pure engine module.
 *
 * This file has no DOM access and no side effects, so it is imported unchanged
 * by the browser UI (app.js) and by the Node test-suite (tests/unit).
 *
 * Everything here is SYNTHETIC and DEFENSIVE. The module generates
 * reproducible, clearly labelled authentication events (pseudonymous accounts,
 * reserved documentation IP ranges, synthetic timestamps), runs three
 * explainable detection rules over them, and scores the detector against the
 * scenario labels. It never connects to anything, never reads real logs on
 * its own, and the scores it produces say nothing about real-world accuracy.
 *
 * Event model
 * -----------
 *   { id, ts, outcome, account, source, reason, scenario, verdict, seq, index }
 *   - ts       synthetic epoch milliseconds (UTC)
 *   - outcome  'success' | 'failure'
 *   - account  pseudonymous identifier such as "u-3f9c" (never a real person)
 *   - source   IPv4 address inside an RFC 5737 documentation range
 *              (192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24) or an IPv6
 *              address inside 2001:db8::/32 (RFC 3849); nothing routable
 *   - reason   short free text for failures ('' for successes)
 *   - scenario / verdict  GROUND-TRUTH labels ('benign' | 'suspicious'). The
 *              detector never reads them; only evaluate() does.
 *   - seq      position in the input (deterministic tie-break for equal ts)
 *   - index    position after sorting by (ts, seq)
 *
 * Detection rules (all thresholds configurable, all windows inclusive)
 * --------------------------------------------------------------------
 *   R1 repeatedFailures    ≥ T failures from one source within W seconds
 *   R2 passwordSpray       failures from one source against ≥ A distinct
 *                          accounts within W seconds
 *   R3 successAfterFailures a success preceded by ≥ F failures for the same
 *                          account within W seconds (scope: any source, or
 *                          only the source of the success)
 *
 * Window semantics. Events are processed in (ts, seq) order. For an event at
 * time t the window is [t − W, t]: an event exactly W seconds earlier counts.
 * Every rule raises one alert per "episode". R1 and R2: the alert is created
 * when the sliding count first reaches the threshold and then absorbs every
 * further failure from the same source that arrives within W seconds of the
 * previous one; a longer pause closes the episode. R3: the first qualifying
 * success raises the alert, which then absorbs every further success for the
 * same account that arrives within W seconds of the previous success (and the
 * failures in between); a longer pause closes it. Each rule is a streaming
 * state machine with O(1) amortised work per event and every event is cited
 * by at most two episodes of a rule, so a dataset of n events costs
 * O(n log n) for the sort plus O(n), and the alerts hold O(n) evidence.
 */

/* ----------------------------------------------------------------- constants */

export const OUTCOMES = Object.freeze(['success', 'failure']);
export const VERDICTS = Object.freeze(['benign', 'suspicious']);
export const FAILURE_REASONS = Object.freeze(['bad_password', 'unknown_account', 'expired_credential', 'account_locked']);
export const DEFAULT_SEED = 42;
export const MAX_SEED = 0xFFFFFFFF;

/** Hard limits that bound memory and CPU for generated and imported data. */
export const LIMITS = Object.freeze({
  maxEvents: 20000,
  maxImportBytes: 4 * 1024 * 1024,
  maxThreshold: 1000,
  maxWindowSeconds: 86400,
  minTs: Date.UTC(2000, 0, 1),
  maxTs: Date.UTC(2100, 0, 1),
  maxFieldLength: 64,
  maxErrorsReported: 25,
});

export const RULES = Object.freeze({
  repeatedFailures: Object.freeze({
    id: 'repeatedFailures',
    code: 'R1',
    order: 0,
    name: 'Repeated failures from one source',
    subject: 'source',
    trigger: 'failure',
    definition: 'Raise an alert when one source produces at least T failed authentication events within any sliding window of W seconds. The window is inclusive: an event exactly W seconds before the current one counts. Once raised, the alert stays open and absorbs further failures from the same source while each new failure arrives within W seconds of the previous one; a longer pause closes it, and a later burst raises a new alert.',
    parameters: Object.freeze(['threshold', 'windowSeconds']),
  }),
  passwordSpray: Object.freeze({
    id: 'passwordSpray',
    code: 'R2',
    order: 1,
    name: 'Password spraying: one source, many accounts',
    subject: 'source',
    trigger: 'failure',
    definition: 'Raise an alert when failed authentication events from one source target at least A distinct accounts within any sliding window of W seconds (inclusive). The alert stays open while failures from that source keep arriving within W seconds of the previous one; a longer pause closes it.',
    parameters: Object.freeze(['accounts', 'windowSeconds']),
  }),
  successAfterFailures: Object.freeze({
    id: 'successAfterFailures',
    code: 'R3',
    order: 2,
    name: 'Success following repeated failures',
    subject: 'account',
    trigger: 'success',
    definition: 'Raise an alert when a successful authentication for an account is preceded, earlier in event order and within the previous W seconds (inclusive), by at least F failed authentication events for the same account. Scope "account" counts failures from any source; scope "source" counts only failures from the source of the success. The first qualifying success raises the alert; further successes for the same account that arrive within W seconds of the previous success, and the failures in between, are absorbed into it, so one incident is one alert. A longer pause closes it.',
    parameters: Object.freeze(['failures', 'windowSeconds', 'scope']),
  }),
});

export const RULE_ORDER = Object.freeze(Object.values(RULES).sort((a, b) => a.order - b.order).map((rule) => rule.id));

export const DEFAULT_CONFIG = Object.freeze({
  repeatedFailures: Object.freeze({ enabled: true, threshold: 5, windowSeconds: 60 }),
  passwordSpray: Object.freeze({ enabled: true, accounts: 5, windowSeconds: 120 }),
  successAfterFailures: Object.freeze({ enabled: true, failures: 3, windowSeconds: 600, scope: 'account' }),
});

export const SCOPES = Object.freeze(['account', 'source']);

/**
 * Catalogue of synthetic scenario kinds. `likelyRules` lists the rules that
 * are expected to fire on the kind at the DEFAULT thresholds: for suspicious
 * kinds these are the hoped-for detections, for benign kinds they are the
 * expected false positives. It is a hypothesis about the synthetic data, not a
 * validated statement about real attacks.
 */
export const SCENARIO_KINDS = Object.freeze({
  baseline: Object.freeze({
    kind: 'baseline', verdict: 'benign', title: 'Routine sign-ins',
    description: 'Accounts signing in from their usual sources, with an occasional mistyped password followed by a successful retry.',
    likelyRules: Object.freeze([]),
  }),
  'forgetful-user': Object.freeze({
    kind: 'forgetful-user', verdict: 'benign', title: 'Forgetful user',
    description: 'One user fails several times in a row from their usual source and then signs in. Benign, but it has the same shape as a guessed password, so rule R3 is expected to flag it.',
    likelyRules: Object.freeze(['successAfterFailures']),
  }),
  'shared-gateway': Object.freeze({
    kind: 'shared-gateway', verdict: 'benign', title: 'Shared office gateway',
    description: 'Many accounts sign in through one shared source, such as an office NAT gateway or proxy. Their occasional failures all appear to come from one place, which can resemble a password spray when the R2 threshold is low.',
    likelyRules: Object.freeze([]),
  }),
  'misconfigured-client': Object.freeze({
    kind: 'misconfigured-client', verdict: 'benign', title: 'Misconfigured service client',
    description: 'A service account keeps retrying an expired credential from one source at a steady cadence. Worth fixing operationally, but not an attack; rule R1 cannot tell it apart from password guessing.',
    likelyRules: Object.freeze(['repeatedFailures']),
  }),
  'brute-force': Object.freeze({
    kind: 'brute-force', verdict: 'suspicious', title: 'Brute force against one account',
    description: 'One source fires many failed attempts at a single account in a short burst, sometimes ending with a success.',
    likelyRules: Object.freeze(['repeatedFailures', 'successAfterFailures']),
  }),
  'password-spray': Object.freeze({
    kind: 'password-spray', verdict: 'suspicious', title: 'Password spray',
    description: 'One source tries one or two passwords against many accounts, including some that do not exist, keeping the rate per account low.',
    likelyRules: Object.freeze(['passwordSpray']),
  }),
  'low-and-slow-spray': Object.freeze({
    kind: 'low-and-slow-spray', verdict: 'suspicious', title: 'Low-and-slow spray',
    description: 'A password spray paced minutes apart so that no short window ever holds enough attempts. The default thresholds are expected to miss it; a wider R2 window catches it at the price of more false positives.',
    likelyRules: Object.freeze([]),
  }),
  'distributed-failures': Object.freeze({
    kind: 'distributed-failures', verdict: 'suspicious', title: 'Distributed failures, then a success',
    description: 'Several sources each fail a few times against the same account before a success arrives from yet another source. Per-source rules see too little from each source; R3 in account scope sees the whole sequence, R3 in source scope does not.',
    likelyRules: Object.freeze(['successAfterFailures']),
  }),
});

export const BASE_TS = Date.UTC(2026, 2, 2, 8, 0, 0); // Monday 2026-03-02 08:00:00 UTC, purely synthetic

/** Dataset presets. `scenarios` lists the scenario specs generated on top of the baseline. */
export const PRESETS = Object.freeze({
  mixed: Object.freeze({
    id: 'mixed', name: 'Mixed day: routine activity plus several synthetic attacks', accounts: 40, hours: 6, sessionsPerAccount: 6,
    scenarios: Object.freeze([
      { kind: 'shared-gateway' }, { kind: 'forgetful-user' }, { kind: 'misconfigured-client' },
      { kind: 'brute-force', success: true }, { kind: 'password-spray' }, { kind: 'distributed-failures' },
    ]),
  }),
  quiet: Object.freeze({
    id: 'quiet', name: 'Quiet day: routine activity, one forgetful user, no attacks', accounts: 30, hours: 4, sessionsPerAccount: 5,
    scenarios: Object.freeze([{ kind: 'forgetful-user' }]),
  }),
  noisy: Object.freeze({
    id: 'noisy', name: 'Noisy day: many benign look-alikes and one brute force', accounts: 60, hours: 8, sessionsPerAccount: 6,
    scenarios: Object.freeze([
      { kind: 'shared-gateway' }, { kind: 'shared-gateway' }, { kind: 'forgetful-user' }, { kind: 'forgetful-user' }, { kind: 'forgetful-user' },
      { kind: 'misconfigured-client' }, { kind: 'misconfigured-client' }, { kind: 'brute-force', success: false },
    ]),
  }),
  stealthy: Object.freeze({
    id: 'stealthy', name: 'Stealthy day: attacks paced to slip under the default thresholds', accounts: 40, hours: 8, sessionsPerAccount: 5,
    scenarios: Object.freeze([{ kind: 'low-and-slow-spray' }, { kind: 'distributed-failures' }, { kind: 'forgetful-user' }]),
  }),
  large: Object.freeze({
    id: 'large', name: 'Large day: about fifteen thousand events across 500 accounts', accounts: 500, hours: 24, sessionsPerAccount: 26,
    scenarios: Object.freeze([
      { kind: 'shared-gateway' }, { kind: 'shared-gateway' }, { kind: 'forgetful-user' }, { kind: 'forgetful-user' }, { kind: 'forgetful-user' },
      { kind: 'misconfigured-client' }, { kind: 'misconfigured-client' }, { kind: 'brute-force', success: true }, { kind: 'brute-force', success: false },
      { kind: 'brute-force', success: true }, { kind: 'password-spray' }, { kind: 'password-spray' }, { kind: 'low-and-slow-spray' },
      { kind: 'distributed-failures' }, { kind: 'distributed-failures' },
    ]),
  }),
  card: Object.freeze({
    id: 'card', name: 'Tiny dataset used for the portfolio card artwork', accounts: 5, hours: 1, sessionsPerAccount: 3,
    scenarios: Object.freeze([{ kind: 'brute-force', success: true, attempts: [7, 9] }, { kind: 'password-spray', accounts: [4, 5], spacing: [20, 60] }]),
  }),
});

/* ---------------------------------------------------------------- utilities */

/** Small, fast, seedable PRNG (mulberry32), the same algorithm as the pathfinding lab. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function normaliseSeed(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > MAX_SEED) {
    throw new RangeError(`seed must be an integer between 0 and ${MAX_SEED}, received ${String(seed)}`);
  }
  return seed >>> 0;
}

const pad = (n, width) => String(n).padStart(width, '0');

/** 'YYYY-MM-DD HH:MM:SS UTC' (optionally with milliseconds); always UTC so output is identical everywhere. */
export function formatUtc(ts, { date = true, millis = false } = {}) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return 'invalid time';
  const time = `${pad(d.getUTCHours(), 2)}:${pad(d.getUTCMinutes(), 2)}:${pad(d.getUTCSeconds(), 2)}${millis ? `.${pad(d.getUTCMilliseconds(), 3)}` : ''}`;
  if (!date) return `${time} UTC`;
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1, 2)}-${pad(d.getUTCDate(), 2)} ${time} UTC`;
}

export function isoTime(ts) {
  return new Date(ts).toISOString();
}

/** Human-readable duration: '250 ms', '42 s', '3 min 20 s', '2 h 05 min'. */
export function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${pad(rest, 2)} min`;
}

export function formatWindow(seconds) {
  return formatDuration(seconds * 1000);
}

/** Amortised O(1) FIFO backing every sliding-window counter. */
class Fifo {
  constructor() { this.items = []; this.head = 0; }
  get size() { return this.items.length - this.head; }
  push(item) { this.items.push(item); }
  front() { return this.items[this.head]; }
  shift() {
    const item = this.items[this.head];
    this.items[this.head] = undefined;
    this.head += 1;
    if (this.head >= 1024 && this.head * 2 >= this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return item;
  }
  values() { return this.items.slice(this.head); }
}

/* ----------------------------------------------------- source address rules */

const IPV4_DOC_PREFIXES = Object.freeze(['192.0.2.', '198.51.100.', '203.0.113.']);

/** True for IPv4 addresses inside the RFC 5737 documentation ranges (dotted decimal, no leading zeros). */
export function isDocumentationIPv4(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1);
  for (const octet of octets) {
    if (octet.length > 1 && octet.startsWith('0')) return false;
    if (Number(octet) > 255) return false;
  }
  return IPV4_DOC_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** True for IPv6 addresses inside 2001:db8::/32 (RFC 3849) written in standard hexadecimal notation. */
export function isDocumentationIPv6(value) {
  if (typeof value !== 'string' || value.length > 45 || !/^[0-9a-fA-F:]+$/.test(value)) return false;
  const parts = value.toLowerCase().split('::');
  if (parts.length > 2) return false;
  const left = parts[0] === '' ? [] : parts[0].split(':');
  const right = parts.length === 2 && parts[1] !== '' ? parts[1].split(':') : [];
  const groups = [...left, ...right];
  if (groups.some((group) => group === '' || group.length > 4)) return false; // stray single colons
  if (parts.length === 1 && groups.length !== 8) return false;
  if (parts.length === 2 && groups.length > 7) return false;
  // The /32 prefix is the first two groups: 2001 and db8. A '::' in second position expands to 0, not db8.
  if (left.length < 2) return false;
  return parseInt(left[0], 16) === 0x2001 && parseInt(left[1], 16) === 0x0db8;
}

export function isAllowedSource(value) {
  return isDocumentationIPv4(value) || isDocumentationIPv6(value);
}

/* ----------------------------------------------------------- configuration */

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validates and completes a threshold configuration. Missing rules or fields
 * fall back to DEFAULT_CONFIG; anything present must be valid. Returns
 * { ok, config, errors: [{ path, message }] }; `config` is null when !ok.
 */
export function validateConfig(input = {}) {
  const errors = [];
  if (!isPlainObject(input)) return { ok: false, config: null, errors: [{ path: '', message: 'the configuration must be an object' }] };
  const config = {};
  for (const key of Object.keys(input)) {
    if (!RULES[key]) errors.push({ path: key, message: `unknown rule "${key}"` });
  }
  for (const ruleId of RULE_ORDER) {
    const defaults = DEFAULT_CONFIG[ruleId];
    const given = input[ruleId] === undefined ? {} : input[ruleId];
    if (!isPlainObject(given)) {
      errors.push({ path: ruleId, message: 'rule settings must be an object' });
      continue;
    }
    const merged = { ...defaults, ...given };
    for (const key of Object.keys(given)) {
      if (!(key in defaults)) errors.push({ path: `${ruleId}.${key}`, message: `unknown setting "${key}"` });
    }
    if (typeof merged.enabled !== 'boolean') errors.push({ path: `${ruleId}.enabled`, message: 'must be true or false' });
    for (const key of RULES[ruleId].parameters) {
      const value = merged[key];
      if (key === 'scope') {
        if (!SCOPES.includes(value)) errors.push({ path: `${ruleId}.scope`, message: `must be one of ${SCOPES.join(', ')}` });
      } else if (key === 'windowSeconds') {
        if (!Number.isInteger(value) || value < 1 || value > LIMITS.maxWindowSeconds) errors.push({ path: `${ruleId}.windowSeconds`, message: `must be a whole number of seconds between 1 and ${LIMITS.maxWindowSeconds}` });
      } else if (!Number.isInteger(value) || value < 1 || value > LIMITS.maxThreshold) {
        errors.push({ path: `${ruleId}.${key}`, message: `must be a whole number between 1 and ${LIMITS.maxThreshold}` });
      }
    }
    config[ruleId] = merged;
  }
  return errors.length === 0 ? { ok: true, config, errors: [] } : { ok: false, config: null, errors };
}

export function normaliseConfig(input = {}) {
  const result = validateConfig(input);
  if (!result.ok) throw new RangeError(`invalid configuration: ${result.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
  return result.config;
}

export function configsEqual(a, b) {
  return JSON.stringify(normaliseConfig(a)) === JSON.stringify(normaliseConfig(b));
}

/* ------------------------------------------------------------ event checks */

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const ACCOUNT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._@-]{0,63}$/;
const TEXT_PATTERN = /^[\x20-\x7E]{0,64}$/; // printable ASCII only; rendered with textContent regardless
const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const EVENT_KEYS = Object.freeze(['id', 'ts', 'time', 'outcome', 'account', 'source', 'reason', 'scenario', 'verdict']);

/**
 * Strict ISO-8601 parser: the calendar fields must round-trip exactly, so
 * 2026-02-30 or 24:00:00 are rejected instead of rolling over as Date.parse would.
 */
export function parseIsoTime(text) {
  if (typeof text !== 'string') return null;
  const match = text.match(ISO_PATTERN);
  if (!match) return null;
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const millis = match[7] ? Number(match[7].padEnd(3, '0')) : 0;
  const utc = Date.UTC(year, month - 1, day, hour, minute, second, millis);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day
    || check.getUTCHours() !== hour || check.getUTCMinutes() !== minute || check.getUTCSeconds() !== second) return null;
  let offsetMinutes = 0;
  if (match[8] !== 'Z') {
    const sign = match[8][0] === '-' ? -1 : 1;
    const offsetHours = Number(match[8].slice(1, 3));
    const offsetMins = Number(match[8].slice(4, 6));
    if (offsetHours > 23 || offsetMins > 59) return null;
    offsetMinutes = sign * (offsetHours * 60 + offsetMins);
  }
  return utc - offsetMinutes * 60000;
}

/**
 * Validates untrusted event records (for example from a local JSON import)
 * against the strict schema and returns normalised copies. Every field is
 * treated as untrusted input: only the known keys are accepted, strings are
 * length- and character-bounded, timestamps must be real calendar instants
 * inside a sane range, and sources must be documentation addresses.
 *
 * Returns { ok, events, errors: [{ index, field, message }], errorCount, labelled }.
 */
export function validateEvents(input, options = {}) {
  const maxEvents = options.maxEvents ?? LIMITS.maxEvents;
  const errors = [];
  let errorCount = 0;
  const fail = (index, field, message) => {
    errorCount += 1;
    if (errors.length < LIMITS.maxErrorsReported) errors.push({ index, field, message });
  };
  let records = input;
  if (isPlainObject(input) && Array.isArray(input.events)) records = input.events;
  if (!Array.isArray(records)) {
    return { ok: false, events: [], errors: [{ index: -1, field: '', message: 'expected a JSON array of events, or an object with an "events" array' }], errorCount: 1, labelled: false };
  }
  if (records.length > maxEvents) {
    return { ok: false, events: [], errors: [{ index: -1, field: '', message: `too many events: ${records.length} (the limit is ${maxEvents})` }], errorCount: 1, labelled: false };
  }
  const ids = new Set();
  const withId = records.filter((record) => isPlainObject(record) && record.id !== undefined).length;
  if (withId !== 0 && withId !== records.length) fail(-1, 'id', 'either every event has an "id" or none does');
  let withVerdict = 0;
  const scenarioVerdicts = new Map();
  const events = [];
  records.forEach((record, index) => {
    if (!isPlainObject(record)) {
      fail(index, '', 'each event must be an object');
      return;
    }
    for (const key of Object.keys(record)) {
      if (!EVENT_KEYS.includes(key)) fail(index, key.slice(0, 64), `unknown field "${key.slice(0, 64)}${key.length > 64 ? '…' : ''}"`);
    }
    let id = record.id;
    if (id === undefined) id = `imp-${pad(index + 1, 5)}`;
    else if (typeof id !== 'string' || !ID_PATTERN.test(id)) fail(index, 'id', 'must be 1–64 characters: letters, digits, ".", "_", ":" or "-"');
    else if (ids.has(id)) fail(index, 'id', `duplicate id "${id}"`);
    ids.add(id);
    let ts = null;
    if (record.ts !== undefined && record.time !== undefined) fail(index, 'ts', 'give either "ts" (milliseconds) or "time" (ISO 8601), not both');
    else if (record.ts !== undefined) {
      if (!Number.isSafeInteger(record.ts)) fail(index, 'ts', 'must be a whole number of milliseconds since 1970-01-01T00:00:00Z');
      else ts = record.ts;
    } else if (record.time !== undefined) {
      ts = parseIsoTime(record.time);
      if (ts === null) fail(index, 'time', 'must be a valid ISO 8601 timestamp such as 2026-03-02T08:14:03Z');
    } else fail(index, 'time', 'missing timestamp: give "time" (ISO 8601) or "ts" (milliseconds)');
    if (ts !== null && (ts < LIMITS.minTs || ts >= LIMITS.maxTs)) fail(index, record.ts !== undefined ? 'ts' : 'time', 'must fall between the years 2000 and 2099');
    if (!OUTCOMES.includes(record.outcome)) fail(index, 'outcome', 'must be "success" or "failure"');
    if (typeof record.account !== 'string' || !ACCOUNT_PATTERN.test(record.account)) fail(index, 'account', 'must be 1–64 characters: letters, digits, ".", "_", "@" or "-"');
    if (!isAllowedSource(record.source)) fail(index, 'source', 'must be an IPv4 address in 192.0.2.0/24, 198.51.100.0/24 or 203.0.113.0/24, or an IPv6 address in 2001:db8::/32 (reserved documentation ranges only)');
    const reason = record.reason === undefined ? '' : record.reason;
    if (typeof reason !== 'string' || !TEXT_PATTERN.test(reason)) fail(index, 'reason', 'must be at most 64 printable ASCII characters');
    const scenario = record.scenario === undefined ? null : record.scenario;
    if (scenario !== null && (typeof scenario !== 'string' || scenario === '' || !TEXT_PATTERN.test(scenario))) fail(index, 'scenario', 'must be 1–64 printable ASCII characters');
    const verdict = record.verdict === undefined ? null : record.verdict;
    if (verdict !== null && !VERDICTS.includes(verdict)) fail(index, 'verdict', 'must be "benign" or "suspicious"');
    if (scenario !== null && verdict === null) fail(index, 'verdict', 'a scenario label requires a verdict');
    if (verdict !== null) {
      withVerdict += 1;
      if (scenario !== null) {
        const seen = scenarioVerdicts.get(scenario);
        if (seen !== undefined && seen !== verdict) fail(index, 'verdict', `scenario "${scenario}" carries both benign and suspicious verdicts`);
        else scenarioVerdicts.set(scenario, verdict);
      }
    }
    events.push({ id, ts, outcome: record.outcome, account: record.account, source: record.source, reason, scenario, verdict, seq: index });
  });
  if (withVerdict !== 0 && withVerdict !== records.length) fail(-1, 'verdict', 'ground truth must label every event or none (some events have a verdict, others do not)');
  if (errorCount > 0) return { ok: false, events: [], errors, errorCount, labelled: false };
  return { ok: true, events, errors: [], errorCount: 0, labelled: withVerdict === records.length && records.length > 0 };
}

function byteLength(text) {
  if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).byteLength;
  return text.length;
}

/**
 * Parses untrusted JSON text (local import) and validates it. JSON.parse only
 * ever produces data; nothing in the text is executed or interpreted as markup.
 */
export function parseImport(text, options = {}) {
  const maxBytes = options.maxBytes ?? LIMITS.maxImportBytes;
  if (typeof text !== 'string') return { ok: false, events: [], errors: [{ index: -1, field: '', message: 'nothing to import' }], errorCount: 1, labelled: false };
  const bytes = byteLength(text);
  if (bytes > maxBytes) return { ok: false, events: [], errors: [{ index: -1, field: '', message: `the file is ${bytes.toLocaleString('en-US')} bytes; the limit is ${maxBytes.toLocaleString('en-US')} bytes` }], errorCount: 1, labelled: false };
  if (text.trim() === '') return { ok: false, events: [], errors: [{ index: -1, field: '', message: 'the text is empty' }], errorCount: 1, labelled: false };
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    return { ok: false, events: [], errors: [{ index: -1, field: '', message: `not valid JSON: ${String(error && error.message).slice(0, 120)}` }], errorCount: 1, labelled: false };
  }
  return validateEvents(data, options);
}

/** Serialises events in the import schema (time as ISO 8601, labels kept when present). */
export function serialiseEvents(events, meta = {}) {
  const records = events.map((event) => {
    const record = { id: event.id, time: isoTime(event.ts), outcome: event.outcome, account: event.account, source: event.source };
    if (event.reason) record.reason = event.reason;
    if (event.scenario !== null && event.scenario !== undefined) record.scenario = event.scenario;
    if (event.verdict !== null && event.verdict !== undefined) record.verdict = event.verdict;
    return record;
  });
  const head = {
    format: 'security-events-lab/v1',
    note: 'Synthetic authentication events generated locally for the Security Event Detection & Investigation Lab. Pseudonymous accounts, reserved documentation IP ranges, synthetic timestamps. Not real log data.',
    ...meta,
  };
  // One event per line keeps the file readable while staying compact enough for the largest preset to re-import.
  const lines = [...Object.entries(head).map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`), '  "events": [', records.map((record) => `    ${JSON.stringify(record)}`).join(',\n'), '  ]'];
  return `{\n${lines.join('\n')}\n}\n`;
}

/** Minimal structural check for events handed directly to detect(); throws TypeError on programming errors. */
function assertEvent(event, position) {
  if (!isPlainObject(event)) throw new TypeError(`event ${position} must be an object`);
  if (typeof event.id !== 'string' || event.id === '') throw new TypeError(`event ${position} needs a non-empty string id`);
  if (!Number.isFinite(event.ts)) throw new TypeError(`event ${position} (${event.id}) needs a finite numeric ts`);
  if (!OUTCOMES.includes(event.outcome)) throw new TypeError(`event ${position} (${event.id}) has an unknown outcome`);
  if (typeof event.account !== 'string' || event.account === '') throw new TypeError(`event ${position} (${event.id}) needs an account`);
  if (typeof event.source !== 'string' || event.source === '') throw new TypeError(`event ${position} (${event.id}) needs a source`);
}

/**
 * Returns a new array of shallow copies sorted by (ts, seq) with `index` set to
 * the sorted position. `seq` defaults to the input position, so equal
 * timestamps keep their input order and the result is fully deterministic.
 */
export function sortEvents(events) {
  if (!Array.isArray(events)) throw new TypeError('events must be an array');
  const copies = events.map((event, position) => {
    assertEvent(event, position);
    return { ...event, reason: event.reason ?? '', scenario: event.scenario ?? null, verdict: event.verdict ?? null, seq: Number.isInteger(event.seq) ? event.seq : position };
  });
  copies.sort((a, b) => (a.ts - b.ts) || (a.seq - b.seq));
  const ids = new Set();
  copies.forEach((event, index) => {
    if (ids.has(event.id)) throw new RangeError(`duplicate event id "${event.id}"`);
    ids.add(event.id);
    event.index = index;
  });
  return copies;
}

/* --------------------------------------------------------------- detection */

export function subjectKey(alert) {
  return alert.rule === 'successAfterFailures' ? `account:${alert.subject.account}` : `source:${alert.subject.source}`;
}

/** Rule plus subject: the identity of an alert's subject across threshold configurations. */
export function alertKey(alert) {
  return `${alert.rule}|${subjectKey(alert)}`;
}

/** True when two alerts of the same rule and subject cover overlapping time spans (the same burst seen under two configurations). */
export function sameIncident(a, b) {
  return a.rule === b.rule && subjectKey(a) === subjectKey(b) && a.firstTs <= b.lastTs && b.firstTs <= a.lastTs;
}

/** The first alert among `candidates` that describes the same incident as `alert`, or null. */
export function findCounterpart(alert, candidates) {
  return candidates.find((candidate) => sameIncident(alert, candidate)) ?? null;
}

/**
 * Streaming detector. Feed events in (ts, seq) order with push(); it returns
 * { created, updated } alert lists for that event. finish() closes open
 * episodes and returns every alert. Labels (scenario, verdict) are never read.
 */
export function createDetector(configInput = DEFAULT_CONFIG) {
  const config = normaliseConfig(configInput);
  const r1 = config.repeatedFailures;
  const r2 = config.passwordSpray;
  const r3 = config.successAfterFailures;
  const w1 = r1.windowSeconds * 1000;
  const w2 = r2.windowSeconds * 1000;
  const w3 = r3.windowSeconds * 1000;
  const sources = new Map();
  const accounts = new Map();
  const alerts = [];
  let last = null;
  let pushed = 0;

  const sourceState = (source) => {
    let state = sources.get(source);
    if (!state) {
      state = { r1: new Fifo(), r2: new Fifo(), r2Counts: new Map(), openR1: null, openR2: null };
      sources.set(source, state);
    }
    return state;
  };
  const accountState = (account) => {
    let state = accounts.get(account);
    if (!state) {
      state = { failures: new Fifo(), openR3: null };
      accounts.set(account, state);
    }
    return state;
  };
  const makeAlert = (rule, subject, event, evidence, metrics) => {
    const alert = {
      id: `A-${alerts.length + 1}`,
      rule,
      code: RULES[rule].code,
      subject,
      triggerEventId: event.id,
      triggerIndex: event.index,
      triggerTs: event.ts,
      windowStart: evidence[0].ts,
      windowEnd: event.ts,
      firstTs: evidence[0].ts,
      lastTs: event.ts,
      evidence: evidence.map((e) => e.id),
      evidenceIndices: evidence.map((e) => e.index),
      metrics,
    };
    alerts.push(alert);
    return alert;
  };

  function push(event) {
    if (!isPlainObject(event) || !Number.isInteger(event.index)) throw new TypeError('push() expects a sorted event with an index (see sortEvents)');
    if (event.index !== pushed) throw new RangeError(`events must be pushed in sorted order without gaps: expected index ${pushed}, received ${event.index}`);
    if (last && ((event.ts < last.ts) || (event.ts === last.ts && event.seq < last.seq))) {
      throw new RangeError(`events must be pushed in (ts, seq) order: ${event.id} arrived after ${last.id}`);
    }
    last = event;
    pushed += 1;
    const created = [];
    const updated = [];
    if (event.outcome === 'failure') {
      const state = sourceState(event.source);
      if (r1.enabled) {
        const fifo = state.r1;
        fifo.push(event);
        while (fifo.front().ts < event.ts - w1) fifo.shift();
        const count = fifo.size;
        const open = state.openR1;
        if (open && event.ts - open.lastTs <= w1) {
          open.lastTs = event.ts;
          open.evidence.push(event.id);
          open.evidenceIndices.push(event.index);
          open.metrics.total += 1;
          open.metrics.peakWindowCount = Math.max(open.metrics.peakWindowCount, count);
          open.metrics.accountSet.add(event.account);
          open.metrics.durationMs = open.lastTs - open.firstTs;
          updated.push(open);
        } else {
          state.openR1 = null;
          if (count >= r1.threshold) {
            const evidence = fifo.values();
            const accountSet = new Set(evidence.map((e) => e.account));
            const alert = makeAlert('repeatedFailures', { source: event.source }, event, evidence, {
              threshold: r1.threshold, windowSeconds: r1.windowSeconds, windowCount: count, peakWindowCount: count, total: evidence.length,
              windowSpanMs: event.ts - evidence[0].ts, durationMs: event.ts - evidence[0].ts, accountSet,
            });
            state.openR1 = alert;
            created.push(alert);
          }
        }
      }
      if (r2.enabled) {
        const fifo = state.r2;
        const counts = state.r2Counts;
        fifo.push(event);
        counts.set(event.account, (counts.get(event.account) || 0) + 1);
        while (fifo.front().ts < event.ts - w2) {
          const gone = fifo.shift();
          const n = counts.get(gone.account) - 1;
          if (n === 0) counts.delete(gone.account); else counts.set(gone.account, n);
        }
        const distinct = counts.size;
        const open = state.openR2;
        if (open && event.ts - open.lastTs <= w2) {
          open.lastTs = event.ts;
          open.evidence.push(event.id);
          open.evidenceIndices.push(event.index);
          open.metrics.total += 1;
          open.metrics.peakWindowAccounts = Math.max(open.metrics.peakWindowAccounts, distinct);
          open.metrics.accountSet.add(event.account);
          open.metrics.durationMs = open.lastTs - open.firstTs;
          updated.push(open);
        } else {
          state.openR2 = null;
          if (distinct >= r2.accounts) {
            const evidence = fifo.values();
            const accountSet = new Set(evidence.map((e) => e.account));
            const alert = makeAlert('passwordSpray', { source: event.source }, event, evidence, {
              accountThreshold: r2.accounts, windowSeconds: r2.windowSeconds, windowAccounts: distinct, peakWindowAccounts: distinct, total: evidence.length,
              windowSpanMs: event.ts - evidence[0].ts, durationMs: event.ts - evidence[0].ts, accountSet,
            });
            state.openR2 = alert;
            created.push(alert);
          }
        }
      }
      if (r3.enabled) {
        const state = accountState(event.account);
        state.failures.push(event);
        const open = state.openR3;
        if (open) {
          if (event.ts - open.metrics.lastSuccessTs <= w3) {
            open.evidence.push(event.id);
            open.evidenceIndices.push(event.index);
            open.metrics.total += 1;
            open.metrics.laterFailures += 1;
            open.lastTs = event.ts;
            open.metrics.durationMs = open.lastTs - open.firstTs;
            updated.push(open);
          } else state.openR3 = null;
        }
      }
    } else if (r3.enabled) {
      const state = accountState(event.account);
      const fifo = state.failures;
      while (fifo.size > 0 && fifo.front().ts < event.ts - w3) fifo.shift();
      const open = state.openR3;
      if (open && event.ts - open.metrics.lastSuccessTs <= w3) {
        // Same incident: the account keeps signing in within W of its previous success.
        open.evidence.push(event.id);
        open.evidenceIndices.push(event.index);
        open.metrics.total += 1;
        open.metrics.successCount += 1;
        open.metrics.successSourceSet.add(event.source);
        open.metrics.lastSuccessTs = event.ts;
        open.lastTs = event.ts;
        open.metrics.durationMs = open.lastTs - open.firstTs;
        updated.push(open);
      } else {
        state.openR3 = null;
        const inWindow = fifo.values();
        const candidates = r3.scope === 'source' ? inWindow.filter((e) => e.source === event.source) : inWindow;
        if (candidates.length >= r3.failures) {
          const sourceSet = new Set(candidates.map((e) => e.source));
          const sameSource = candidates.filter((e) => e.source === event.source).length;
          const evidence = [...candidates, event];
          const alert = makeAlert('successAfterFailures', { account: event.account, source: event.source }, event, evidence, {
            failures: r3.failures, windowSeconds: r3.windowSeconds, scope: r3.scope, failureCount: candidates.length,
            sameSource, distinctSources: sourceSet.size, sourceSet,
            firstFailureTs: candidates[0].ts, lastFailureTs: candidates[candidates.length - 1].ts, successTs: event.ts,
            spanMs: event.ts - candidates[0].ts, durationMs: event.ts - candidates[0].ts, total: evidence.length,
            successCount: 1, successSourceSet: new Set([event.source]), lastSuccessTs: event.ts, laterFailures: 0,
          });
          state.openR3 = alert;
          created.push(alert);
        }
      }
    }
    return { created, updated };
  }

  function finish() {
    for (const alert of alerts) {
      const { metrics } = alert;
      if (metrics.accountSet) {
        metrics.accounts = [...metrics.accountSet].sort();
        metrics.distinctAccounts = metrics.accounts.length;
        delete metrics.accountSet;
      }
      if (metrics.sourceSet) {
        metrics.sources = [...metrics.sourceSet].sort();
        delete metrics.sourceSet;
      }
      if (metrics.successSourceSet) {
        metrics.successSources = [...metrics.successSourceSet].sort();
        delete metrics.successSourceSet;
      }
    }
    for (const state of sources.values()) {
      state.openR1 = null;
      state.openR2 = null;
    }
    for (const state of accounts.values()) state.openR3 = null;
    return alerts;
  }

  return { push, finish, get alerts() { return alerts; }, get config() { return config; }, get pushed() { return pushed; } };
}

/**
 * Batch detection: sorts the events, streams them through the detector and
 * returns { events (sorted, indexed), alerts, config, summary }.
 */
export function detect(events, configInput = DEFAULT_CONFIG) {
  const detector = createDetector(configInput);
  const sorted = sortEvents(events);
  for (const event of sorted) detector.push(event);
  const alerts = detector.finish();
  return { events: sorted, alerts, config: detector.config, summary: summarise(sorted, alerts) };
}

/** Counts shown in the summary panel; every number is computed from the data. */
export function summarise(events, alerts) {
  const accounts = new Set();
  const sources = new Set();
  let successes = 0;
  let failures = 0;
  let firstTs = null;
  let lastTs = null;
  for (const event of events) {
    accounts.add(event.account);
    sources.add(event.source);
    if (event.outcome === 'success') successes += 1; else failures += 1;
    if (firstTs === null || event.ts < firstTs) firstTs = event.ts;
    if (lastTs === null || event.ts > lastTs) lastTs = event.ts;
  }
  const byRule = {};
  for (const ruleId of RULE_ORDER) byRule[ruleId] = 0;
  const flagged = new Set();
  for (const alert of alerts) {
    byRule[alert.rule] += 1;
    for (const id of alert.evidence) flagged.add(id);
  }
  return {
    events: events.length, successes, failures, accounts: accounts.size, sources: sources.size,
    firstTs, lastTs, spanMs: firstTs === null ? 0 : lastTs - firstTs,
    alerts: alerts.length, byRule, flaggedEvents: flagged.size,
  };
}

/** Alerts grouped by rule, then by affected source or account, preserving alert order. */
export function groupAlerts(alerts) {
  return RULE_ORDER.map((ruleId) => {
    const groups = new Map();
    for (const alert of alerts) {
      if (alert.rule !== ruleId) continue;
      const key = subjectKey(alert);
      if (!groups.has(key)) groups.set(key, { key, subject: alert.subject, label: ruleId === 'successAfterFailures' ? alert.subject.account : alert.subject.source, alerts: [] });
      groups.get(key).alerts.push(alert);
    }
    return { rule: ruleId, code: RULES[ruleId].code, name: RULES[ruleId].name, total: [...groups.values()].reduce((n, g) => n + g.alerts.length, 0), groups: [...groups.values()] };
  });
}

/**
 * Compares the alerts of two detection results over the same events. Alerts
 * are matched by incident (same rule, same subject, overlapping time span),
 * so three short episodes under one window can match one long episode under
 * another. Returns alerts only in A, only in B, and the matched alerts of
 * each side (`both` from A, `bothB` from B).
 */
export function diffAlerts(alertsA, alertsB) {
  const onlyA = [];
  const onlyB = [];
  const both = [];
  const matchedB = new Set();
  for (const a of alertsA) {
    const partners = alertsB.filter((b) => sameIncident(a, b));
    if (partners.length === 0) onlyA.push(a);
    else {
      both.push(a);
      for (const b of partners) matchedB.add(b.id);
    }
  }
  for (const b of alertsB) if (!matchedB.has(b.id)) onlyB.push(b);
  return { onlyA, onlyB, both, bothB: alertsB.filter((b) => matchedB.has(b.id)) };
}

/* ------------------------------------------------------------ explanations */

const list = (items = [], max = 6) => (items.length <= max ? items.join(', ') : `${items.slice(0, max).join(', ')} and ${items.length - max} more`);

/**
 * Plain-language explanation of an alert: what the rule saw, why that is a
 * signal worth investigating, and why it is not proof of compromise. Pure
 * strings built from the alert's own metrics (no event lookup needed).
 */
export function explainAlert(alert) {
  const m = alert.metrics;
  const when = (ts) => formatUtc(ts);
  const accounts = m.accounts ?? [...(m.accountSet ?? [])].sort();
  const distinctAccounts = m.distinctAccounts ?? accounts.length;
  const sources = m.sources ?? [...(m.sourceSet ?? [])].sort();
  if (alert.rule === 'repeatedFailures') {
    return {
      headline: `${m.windowCount} failed sign-ins from ${alert.subject.source} within ${formatDuration(m.windowSpanMs)}`,
      detail: `Rule R1 fires when one source accumulates at least ${m.threshold} failures within ${formatWindow(m.windowSeconds)}. Source ${alert.subject.source} reached ${m.windowCount} failures between ${when(alert.windowStart)} and ${when(alert.windowEnd)}, against ${distinctAccounts === 1 ? 'one account' : `${distinctAccounts} accounts`} (${list(accounts)}). The burst continued until ${when(alert.lastTs)}: ${m.total} failures over ${formatDuration(m.durationMs)}, peaking at ${m.peakWindowCount} inside a single ${formatWindow(m.windowSeconds)} span.`,
      caveat: 'Repeated failures from one source are consistent with password guessing, but a misconfigured client retrying stale credentials, a shared gateway or a user with a stuck key produce the same signal. Treat it as a reason to investigate, not as evidence of compromise.',
      nextSteps: 'Check which accounts were targeted, whether any attempt from this source later succeeded, and whether the source is a known gateway or an automated client.',
    };
  }
  if (alert.rule === 'passwordSpray') {
    return {
      headline: `Failures against ${m.windowAccounts} distinct accounts from ${alert.subject.source} within ${formatDuration(m.windowSpanMs)}`,
      detail: `Rule R2 fires when failures from one source touch at least ${m.accountThreshold} distinct accounts within ${formatWindow(m.windowSeconds)}. Source ${alert.subject.source} reached ${m.windowAccounts} accounts between ${when(alert.windowStart)} and ${when(alert.windowEnd)}. Over the whole burst, until ${when(alert.lastTs)}, it produced ${m.total} failures against ${distinctAccounts} distinct accounts (${list(accounts)}), peaking at ${m.peakWindowAccounts} accounts inside a single ${formatWindow(m.windowSeconds)} span.`,
      caveat: 'One source failing against many accounts is the shape of a password spray, but an office gateway, VPN concentrator or proxy that many legitimate users share can look identical. The alert says that many accounts failed from one place, not who was behind it.',
      nextSteps: 'Check whether the accounts exist, whether the source is a shared egress address, and whether any of the attempts succeeded.',
    };
  }
  const scopeText = m.scope === 'source' ? 'counting only failures from the same source' : 'counting failures from any source';
  const successSources = m.successSources ?? [...(m.successSourceSet ?? [])].sort();
  const more = m.successCount - 1;
  const followUp = more > 0
    ? ` The account then signed in successfully ${more} more time${more === 1 ? '' : 's'}, each within ${formatWindow(m.windowSeconds)} of the previous success, until ${when(m.lastSuccessTs)}${m.laterFailures > 0 ? `, with ${m.laterFailures} further failure${m.laterFailures === 1 ? '' : 's'} in between` : ''}; ${successSources.length === 1 ? 'all from the same source' : `the successes came from ${successSources.length} distinct sources (${list(successSources)})`}. Those sign-ins are part of this alert.`
    : '';
  return {
    headline: `Successful sign-in for ${alert.subject.account} from ${alert.subject.source} after ${m.failureCount} failed attempts`,
    detail: `Rule R3 fires when a success is preceded by at least ${m.failures} failures for the same account within ${formatWindow(m.windowSeconds)} (${scopeText}). Account ${alert.subject.account} failed ${m.failureCount} times between ${when(m.firstFailureTs)} and ${when(m.lastFailureTs)} (${m.sameSource} from ${alert.subject.source}; ${m.distinctSources === 1 ? 'one source' : `${m.distinctSources} distinct sources`}: ${list(sources)}), then succeeded from ${alert.subject.source} at ${when(m.successTs)}.${followUp}`,
    caveat: 'A success after repeated failures is the sequence a guessed password would produce, but it is also exactly what a user who mistyped a password and then remembered it produces. The sequence is suspicious because it is ambiguous; it does not prove that the account was compromised.',
    nextSteps: 'Compare the successful source with the account\'s usual sources, check whether the failures came from the same place as the success, and confirm the activity with the account owner before concluding anything.',
  };
}

/* -------------------------------------------------------------- evaluation */

/**
 * Scores detector output against the ground-truth labels carried by the
 * events. Definitions (stated on the page as well):
 *   - an alert is a TRUE POSITIVE when at least one of its evidence events is
 *     labelled suspicious, otherwise a FALSE POSITIVE; it is a STRICT true
 *     positive when its trigger event itself is labelled suspicious;
 *   - precision = true-positive alerts / all alerts (null when there are no
 *     alerts); precisionStrict uses the strict true positives;
 *   - a suspicious scenario is DETECTED when any alert's evidence includes one
 *     of its events; recall = detected / suspicious scenarios (null when the
 *     data holds no suspicious scenario). This is lenient: one attack event
 *     inside the evidence of an alert raised on a victim's own later login is
 *     enough. The STRICT variant requires an alert whose trigger event belongs
 *     to the scenario (recallStrict, detectedStrict);
 *   - a benign scenario is FLAGGED when a false-positive alert includes one of
 *     its events.
 * Events that carry a verdict but no scenario are grouped into one pseudo
 * scenario per verdict (its key starts with a character the schema does not
 * allow in scenario names, so it can never collide with a real one).
 * Evaluation is only available when every event is labelled. Scores describe
 * the synthetic scenarios only; they say nothing about real-world accuracy.
 */
export const UNLABELLED_PREFIX = '\u00B7 unlabelled ';

export function evaluate(events, alerts, scenarioCatalogue = []) {
  if (events.length === 0) return { available: false, reason: 'There are no events, so there is nothing to score.' };
  const labelled = events.filter((event) => event.verdict === 'benign' || event.verdict === 'suspicious').length;
  if (labelled === 0) return { available: false, reason: 'These events carry no ground-truth labels, so precision and recall cannot be computed.' };
  if (labelled !== events.length) return { available: false, reason: `Only ${labelled} of ${events.length} events carry a ground-truth label; every event must be labelled before precision and recall can be computed.` };
  const catalogue = new Map(scenarioCatalogue.map((scenario) => [scenario.id, scenario]));
  const byId = new Map();
  const groups = new Map();
  const groupOf = (event) => event.scenario ?? `${UNLABELLED_PREFIX}${event.verdict}`;
  for (const event of events) {
    byId.set(event.id, event);
    const key = groupOf(event);
    let group = groups.get(key);
    if (!group) {
      const known = catalogue.get(key);
      group = { id: key, kind: known ? known.kind : null, title: known ? known.title : (event.scenario ?? `Unlabelled ${event.verdict} events`), verdict: event.verdict, events: 0, alertIds: [], triggeredAlertIds: [], falsePositiveAlertIds: [], rules: new Set() };
      groups.set(key, group);
    }
    group.events += 1;
  }
  const byRule = {};
  for (const ruleId of RULE_ORDER) byRule[ruleId] = { total: 0, truePositive: 0, truePositiveStrict: 0, falsePositive: 0 };
  const rows = alerts.map((alert) => {
    const scenarios = new Set();
    let truePositive = false;
    for (const id of alert.evidence) {
      const event = byId.get(id);
      if (!event) throw new RangeError(`alert ${alert.id} cites unknown event ${id}`);
      scenarios.add(groupOf(event));
      if (event.verdict === 'suspicious') truePositive = true;
    }
    const trigger = byId.get(alert.triggerEventId);
    const truePositiveStrict = trigger.verdict === 'suspicious';
    const triggerGroup = groupOf(trigger);
    groups.get(triggerGroup).triggeredAlertIds.push(alert.id);
    byRule[alert.rule].total += 1;
    if (truePositive) byRule[alert.rule].truePositive += 1; else byRule[alert.rule].falsePositive += 1;
    if (truePositiveStrict) byRule[alert.rule].truePositiveStrict += 1;
    for (const key of scenarios) {
      const group = groups.get(key);
      group.alertIds.push(alert.id);
      group.rules.add(alert.rule);
      if (!truePositive) group.falsePositiveAlertIds.push(alert.id);
    }
    return { id: alert.id, rule: alert.rule, truePositive, truePositiveStrict, triggerScenario: triggerGroup, scenarios: [...scenarios] };
  });
  const truePositive = rows.filter((row) => row.truePositive).length;
  const truePositiveStrict = rows.filter((row) => row.truePositiveStrict).length;
  const falsePositive = rows.length - truePositive;
  const suspicious = [...groups.values()].filter((group) => group.verdict === 'suspicious');
  const benign = [...groups.values()].filter((group) => group.verdict === 'benign');
  const detected = suspicious.filter((group) => group.alertIds.length > 0);
  const detectedStrict = suspicious.filter((group) => group.triggeredAlertIds.length > 0);
  const missed = suspicious.filter((group) => group.alertIds.length === 0);
  const flagged = benign.filter((group) => group.falsePositiveAlertIds.length > 0);
  return {
    available: true,
    reason: null,
    alerts: { total: rows.length, truePositive, truePositiveStrict, falsePositive, rows, byRule },
    precision: rows.length > 0 ? truePositive / rows.length : null,
    precisionStrict: rows.length > 0 ? truePositiveStrict / rows.length : null,
    recall: suspicious.length > 0 ? detected.length / suspicious.length : null,
    recallStrict: suspicious.length > 0 ? detectedStrict.length / suspicious.length : null,
    scenarios: {
      total: groups.size,
      suspicious: { total: suspicious.length, detected: detected.length, detectedStrict: detectedStrict.length, missed: missed.map((g) => g.id) },
      benign: { total: benign.length, flagged: flagged.map((g) => g.id) },
      rows: [...groups.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })).map((group) => ({ id: group.id, kind: group.kind, title: group.title, verdict: group.verdict, events: group.events, alertIds: group.alertIds, triggeredAlertIds: group.triggeredAlertIds, falsePositiveAlertIds: group.falsePositiveAlertIds, rules: [...group.rules], detected: group.verdict === 'suspicious' ? group.alertIds.length > 0 : null, detectedStrict: group.verdict === 'suspicious' ? group.triggeredAlertIds.length > 0 : null, flagged: group.verdict === 'benign' ? group.falsePositiveAlertIds.length > 0 : null })),
    },
  };
}

/* -------------------------------------------------------- synthetic data */

const HEX = '0123456789abcdef';

function allDocumentationIPv4() {
  const out = [];
  for (const prefix of IPV4_DOC_PREFIXES) for (let host = 1; host <= 254; host += 1) out.push(`${prefix}${host}`);
  return out;
}

/**
 * Generates a reproducible synthetic dataset: the same seed and preset always
 * produce the same events, in every environment. Events are emitted in
 * scenario order, NOT in time order, so consumers must sort (detect() does).
 * Returns { seed, preset, events, scenarios, meta }.
 */
export function generateDataset(options = {}) {
  const seed = normaliseSeed(options.seed ?? DEFAULT_SEED);
  const presetId = options.preset ?? 'mixed';
  const preset = PRESETS[presetId];
  if (!preset) throw new RangeError(`unknown preset "${String(presetId)}"`);
  const random = mulberry32(seed);
  const int = (lo, hi) => lo + Math.floor(random() * (hi - lo + 1));
  const pick = (array) => array[Math.floor(random() * array.length)];
  const shuffle = (array) => {
    const copy = array.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const hex4 = () => HEX[int(0, 15)] + HEX[int(0, 15)] + HEX[int(0, 15)] + HEX[int(0, 15)];
  const identifiers = new Set();
  const freshId = (prefix) => {
    for (;;) {
      const id = `${prefix}-${hex4()}`;
      if (!identifiers.has(id)) {
        identifiers.add(id);
        return id;
      }
    }
  };
  const baseTs = BASE_TS;
  const durationMs = preset.hours * 3600 * 1000;
  const directory = [];
  for (let i = 0; i < preset.accounts; i += 1) directory.push(freshId('u'));
  const pool = shuffle(allDocumentationIPv4());
  let poolIndex = 0;
  const nextSource = () => {
    if (poolIndex >= pool.length) throw new RangeError('the documentation address pool is exhausted');
    return pool[poolIndex++];
  };
  const profiles = new Map();
  const scenarios = [];
  const newScenario = (kind) => {
    const spec = SCENARIO_KINDS[kind];
    const scenario = { id: `scn-${scenarios.length + 1}`, kind, verdict: spec.verdict, title: spec.title, accounts: [], sources: [], eventIds: [], startTs: null, endTs: null };
    scenarios.push(scenario);
    return scenario;
  };
  const baseline = newScenario('baseline');
  for (const account of directory) {
    const source = nextSource();
    profiles.set(account, { source, failRate: 0.05, scenario: baseline });
    baseline.sources.push(source);
  }
  baseline.accounts = directory.slice();
  const events = [];
  const emit = (scenario, ts, outcome, account, source, reason = '') => {
    const rounded = Math.round(ts);
    const event = { id: `e-${pad(events.length + 1, 5)}`, ts: rounded, outcome, account, source, reason, scenario: scenario.id, verdict: scenario.verdict };
    events.push(event);
    scenario.eventIds.push(event.id);
    if (scenario.startTs === null || rounded < scenario.startTs) scenario.startTs = rounded;
    if (scenario.endTs === null || rounded > scenario.endTs) scenario.endTs = rounded;
    return event;
  };
  const reserved = new Set();
  const freeAccount = () => {
    const candidates = directory.filter((account) => !reserved.has(account));
    if (candidates.length === 0) throw new RangeError('no free account left for the scenario');
    const account = pick(candidates);
    reserved.add(account);
    return account;
  };
  const startWithin = (lengthMs) => baseTs + 15 * 60000 + random() * Math.max(0, durationMs - 30 * 60000 - lengthMs);
  const addSubject = (scenario, account, source) => {
    if (account && !scenario.accounts.includes(account)) scenario.accounts.push(account);
    if (source && !scenario.sources.includes(source)) scenario.sources.push(source);
  };

  const builders = {
    'shared-gateway': (scenario) => {
      const gateway = nextSource();
      const size = Math.min(int(12, 20), Math.max(1, directory.length - reserved.size));
      for (let i = 0; i < size; i += 1) {
        const account = freeAccount();
        profiles.set(account, { source: gateway, failRate: 0.09, scenario });
        addSubject(scenario, account, gateway);
      }
    },
    'forgetful-user': (scenario) => {
      const account = freeAccount();
      const source = profiles.get(account).source;
      const attempts = int(3, 5);
      let t = startWithin(5 * 60000);
      for (let i = 0; i < attempts; i += 1) {
        emit(scenario, t, 'failure', account, source, 'bad_password');
        t += int(8000, 45000);
      }
      emit(scenario, t, 'success', account, source);
      addSubject(scenario, account, source);
    },
    'misconfigured-client': (scenario) => {
      const account = freshId('svc');
      const source = nextSource();
      const spanMs = int(20, 90) * 60000;
      let t = startWithin(spanMs);
      const end = t + spanMs;
      while (t < end) {
        emit(scenario, t, 'failure', account, source, 'expired_credential');
        t += int(10000, 25000); // a retry loop with a short back-off
      }
      addSubject(scenario, account, source);
    },
    'brute-force': (scenario, spec) => {
      const account = freeAccount();
      const source = nextSource();
      const [lo, hi] = spec.attempts ?? [25, 80];
      const attempts = int(lo, hi);
      let t = startWithin(10 * 60000);
      for (let i = 0; i < attempts; i += 1) {
        emit(scenario, t, 'failure', account, source, 'bad_password');
        t += 300 + random() * 3700;
      }
      if (spec.success) emit(scenario, t + int(1000, 5000), 'success', account, source);
      addSubject(scenario, account, source);
    },
    'password-spray': (scenario, spec, slow = false) => {
      const source = nextSource();
      const [lo, hi] = spec.accounts ?? (slow ? [10, 16] : [15, 40]);
      const count = Math.min(int(lo, hi), directory.length);
      const targets = shuffle(directory).slice(0, count).map((account) => ({ account, reason: 'bad_password' }));
      const ghosts = slow ? int(1, 3) : int(3, 6);
      for (let i = 0; i < ghosts; i += 1) targets.push({ account: freshId('u'), reason: 'unknown_account' });
      const [spaceLo, spaceHi] = spec.spacing ?? (slow ? [150, 420] : [15, 45]);
      const order = shuffle(targets);
      let t = startWithin(order.length * 2 * spaceHi * 1000);
      for (const target of order) {
        const attempts = !slow && random() < 0.15 ? 2 : 1; // mostly one guess per account, occasionally two
        for (let i = 0; i < attempts; i += 1) {
          emit(scenario, t, 'failure', target.account, source, target.reason);
          addSubject(scenario, target.account, source);
          t += int(spaceLo * 1000, spaceHi * 1000);
        }
      }
    },
    'low-and-slow-spray': (scenario, spec) => builders['password-spray'](scenario, spec, true),
    'distributed-failures': (scenario) => {
      const account = freeAccount();
      const sourceCount = int(6, 12);
      let t = startWithin(90 * 60000);
      for (let s = 0; s < sourceCount; s += 1) {
        const source = nextSource();
        const attempts = int(1, 3);
        for (let i = 0; i < attempts; i += 1) {
          emit(scenario, t, 'failure', account, source, 'bad_password');
          addSubject(scenario, account, source);
          t += int(20000, 150000);
        }
      }
      const finalSource = nextSource();
      emit(scenario, t + int(10000, 60000), 'success', account, finalSource);
      addSubject(scenario, account, finalSource);
    },
  };

  for (const spec of preset.scenarios) {
    const builder = builders[spec.kind];
    if (!builder) throw new RangeError(`unknown scenario kind "${spec.kind}"`);
    builder(newScenario(spec.kind), spec);
  }

  // Routine activity for every account, labelled with the account's profile scenario (baseline or shared gateway).
  for (const account of directory) {
    const profile = profiles.get(account);
    const sessions = Math.max(1, Math.round(preset.sessionsPerAccount * (0.5 + random())));
    for (let s = 0; s < sessions; s += 1) {
      const t = baseTs + random() * durationMs;
      const r = random();
      if (r < profile.failRate * 0.2) {
        emit(profile.scenario, t, 'failure', account, profile.source, 'bad_password');
        const t2 = t + int(5000, 40000);
        emit(profile.scenario, t2, 'failure', account, profile.source, 'bad_password');
        emit(profile.scenario, t2 + int(5000, 60000), 'success', account, profile.source);
      } else if (r < profile.failRate) {
        emit(profile.scenario, t, 'failure', account, profile.source, 'bad_password');
        emit(profile.scenario, t + int(5000, 90000), 'success', account, profile.source);
      } else if (r < profile.failRate + 0.01) {
        emit(profile.scenario, t, 'failure', account, profile.source, 'bad_password');
      } else {
        emit(profile.scenario, t, 'success', account, profile.source);
      }
    }
  }
  if (events.length > LIMITS.maxEvents) throw new RangeError(`the preset produced ${events.length} events, more than the limit of ${LIMITS.maxEvents}`);
  const accounts = new Set(events.map((e) => e.account));
  const sources = new Set(events.map((e) => e.source));
  return {
    seed,
    preset: preset.id,
    events,
    scenarios,
    meta: { baseTs, durationMs, accounts: accounts.size, sources: sources.size, directory: directory.length },
  };
}

/** Convenience: generate, sort and detect in one call (used by tests and the card preview). */
export function runSynthetic(options = {}, config = DEFAULT_CONFIG) {
  const dataset = generateDataset(options);
  const result = detect(dataset.events, config);
  const evaluation = evaluate(result.events, result.alerts, dataset.scenarios);
  return { dataset, ...result, evaluation };
}
