import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { Toaster, toast } from 'sonner';
import {
  callFirebaseFunction,
  firebaseErrorMessage,
  getFirebaseServices,
} from '../lib/firebase';

type Grant = {
  id: string;
  label: string;
  email?: string | null;
  role: 'visitor' | 'footballer' | 'admin';
  notes?: string | null;
  created_at: number;
  expires_at: number;
  max_uses: number;
  max_ips: number;
  use_count: number;
  last_used_at?: number | null;
  revoked_at?: number | null;
};

type AccessEvent = {
  id: string;
  grant_id?: string | null;
  result: string;
  ip: string;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  postal_code?: string | null;
  asn?: string | null;
  user_agent?: string | null;
  client_meta?: string | null;
  requested_path?: string | null;
  occurred_at: number;
  label?: string | null;
  email?: string | null;
};

type MirrorStatus = {
  count: number;
  last_full_sync_at?: number | null;
  customer_count_at_sync?: number | null;
};

type GuideResponse = {
  base64: string;
  contentType: string;
  filename: string;
};

const adminGuides = [
  {
    id: 'access',
    category: 'PRIVATE ACCESS',
    title: 'Access Key Guide',
    description: 'Create and manage secure access for private visitors.',
  },
  {
    id: 'orders',
    category: 'ORDERS & FULFILLMENT',
    title: 'Shopify Order Guide',
    description: 'Review checkout, order transfer, and fulfillment.',
  },
  {
    id: 'billing',
    category: 'FIREBASE BILLING',
    title: 'Firebase Billing Setup Guide',
    description: 'Open the step-by-step Blaze billing setup walkthrough.',
  },
  {
    id: 'agreement',
    category: 'PROJECT AGREEMENT',
    title: 'Development & Support Agreement',
    description: 'Open the fillable five-page agreement for review and signature.',
  },
] as const;

type AdminGuideId = (typeof adminGuides)[number]['id'];

type FeedbackItem = {
  id: string;
  rating: number | null;
  category: string;
  message: string;
  page: string;
  name?: string | null;
  email?: string | null;
  status: string;
  submitted_at?: string | null;
};

type SupportAllocation = 'unreviewed' | 'grace' | 'bank' | 'non_billable';

type SupportPlan = {
  bank_total_hours: number;
  bank_value_dollars: number;
  grace_days: number;
  grace_total_hours: number;
  hourly_rate: number;
  launch_at?: number | null;
};

type SupportEntry = {
  id: string;
  actual_hours?: number | null;
  additions?: number;
  allocation: SupportAllocation;
  author_email?: string | null;
  author_name?: string | null;
  changed_files?: Array<{ additions: number; deletions: number; path: string }>;
  commit_url?: string | null;
  created_at: number;
  deletions?: number;
  description?: string | null;
  estimate_hours: number;
  files_changed?: number;
  occurred_at: number;
  sha?: string;
  source: 'deployment' | 'manual';
  title: string;
  updated_at: number;
  updated_by_email?: string | null;
  void_reason?: string | null;
  voided_at?: number | null;
};

type SupportAuditEvent = {
  id: string;
  action: string;
  actor_email?: string | null;
  details?: Record<string, unknown>;
  occurred_at: number;
};

type SupportTracker = {
  audit: SupportAuditEvent[];
  entries: SupportEntry[];
  plan: SupportPlan;
  summary: {
    bank_remaining_hours: number;
    bank_used_hours: number;
    grace_ends_at?: number | null;
    grace_remaining_hours: number;
    grace_used_hours: number;
    unreviewed_count: number;
  };
};

function defaultExpiration() {
  const date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function dateTime(value?: number | null) {
  return value ? new Date(value).toLocaleString() : '—';
}

function feedbackDateTime(value?: string | null) {
  if (!value) return '—';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : '—';
}

function dateInput(value?: number | null) {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function hours(value?: number | null) {
  return `${Number(value || 0).toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')}h`;
}

const allocationLabels: Record<SupportAllocation, string> = {
  bank: 'Future-work bank',
  grace: '30-day bug-fix window',
  non_billable: 'Non-billable / included',
  unreviewed: 'Unreviewed',
};

function allocationClasses(allocation: SupportAllocation) {
  if (allocation === 'bank') {
    return 'border-sky-400/45 bg-sky-400/10 text-sky-100';
  }
  if (allocation === 'grace') {
    return 'border-emerald-400/45 bg-emerald-400/10 text-emerald-100';
  }
  if (allocation === 'non_billable') {
    return 'border-white/20 bg-white/5 text-white/60';
  }
  return 'border-amber-400/45 bg-amber-400/10 text-amber-100';
}

function grantStatus(grant: Grant) {
  if (grant.revoked_at) return 'revoked';
  if (grant.expires_at <= Date.now()) return 'expired';
  if (grant.use_count >= grant.max_uses) return 'exhausted';
  return 'active';
}

function statusClasses(status: string) {
  if (status === 'active' || status === 'allowed') {
    return 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200';
  }
  if (status === 'revoked' || status === 'denied') {
    return 'border-red-400/50 bg-red-400/10 text-red-200';
  }
  return 'border-amber-400/50 bg-amber-400/10 text-amber-100';
}

function clientSummary(event: AccessEvent) {
  let meta: Record<string, unknown> = {};
  try {
    meta = event.client_meta ? JSON.parse(event.client_meta) : {};
  } catch {
    meta = {};
  }
  const details = [
    meta.language,
    meta.timezone,
    meta.screen,
    meta.platform,
    meta.logicalProcessors ? `${meta.logicalProcessors} logical processors` : '',
    meta.deviceMemoryGb ? `${meta.deviceMemoryGb} GB memory` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return [event.user_agent, details].filter(Boolean).join(' | ') || 'Not supplied';
}

function locationSummary(event: AccessEvent) {
  const place = [event.city, event.region, event.postal_code, event.country]
    .filter(Boolean)
    .join(', ');
  const coordinates =
    event.latitude && event.longitude ? `${event.latitude}, ${event.longitude}` : '';
  const network = event.asn ? `AS${event.asn}` : '';
  return [place, coordinates, network].filter(Boolean).join(' · ') || 'Not supplied';
}

function decodeBase64(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

const panel = 'border border-white/15 bg-white/[0.035] p-5 sm:p-7';
const input =
  'mt-2 w-full border border-white/20 bg-black px-3 py-3 text-sm text-white outline-none transition focus:border-white/70';
const button =
  'border border-white bg-white px-4 py-3 text-xs tracking-[0.18em] text-black transition hover:bg-transparent hover:text-white disabled:cursor-not-allowed disabled:opacity-40';
const secondaryButton =
  'border border-white/30 px-4 py-3 text-xs tracking-[0.16em] text-white transition hover:border-white disabled:cursor-not-allowed disabled:opacity-40';

function SupportTrackerSection() {
  const [tracker, setTracker] = useState<SupportTracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [launchDate, setLaunchDate] = useState('');

  const loadTracker = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callFirebaseFunction<Record<string, never>, SupportTracker>(
        'getSupportTracker',
        {},
      );
      setTracker(result);
      setLaunchDate(dateInput(result.plan.launch_at));
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The support tracker could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTracker();
  }, [loadTracker]);

  async function saveLaunchDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    try {
      const launchAt = launchDate
        ? new Date(`${launchDate}T00:00:00`).toISOString()
        : null;
      await callFirebaseFunction<{ launchAt: string | null }, { launchAt: number | null }>(
        'setSupportLaunchDate',
        { launchAt },
      );
      toast.success(launchDate ? 'Official launch date saved.' : 'Launch date cleared.');
      await loadTracker();
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The launch date could not be saved.'));
    } finally {
      setWorking(false);
    }
  }

  async function createEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setWorking(true);
    try {
      await callFirebaseFunction<Record<string, FormDataEntryValue>, { id: string }>(
        'createSupportEntry',
        values,
      );
      toast.success('Work entry logged.');
      form.reset();
      await loadTracker();
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The work entry could not be logged.'));
    } finally {
      setWorking(false);
    }
  }

  async function updateEntry(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    setWorking(true);
    try {
      await callFirebaseFunction<Record<string, FormDataEntryValue | string>, { ok: boolean }>(
        'updateSupportEntry',
        { ...values, id },
      );
      toast.success('Hours reviewed and saved.');
      await loadTracker();
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The work entry could not be updated.'));
    } finally {
      setWorking(false);
    }
  }

  async function voidEntry(id: string) {
    const reason = window.prompt('Why should this entry be voided? The audit record will remain.');
    if (!reason?.trim()) return;
    setWorking(true);
    try {
      await callFirebaseFunction<{ id: string; reason: string }, { ok: boolean }>(
        'voidSupportEntry',
        { id, reason },
      );
      toast.success('Entry voided; its audit history was preserved.');
      await loadTracker();
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The work entry could not be voided.'));
    } finally {
      setWorking(false);
    }
  }

  if (loading && !tracker) {
    return (
      <section className={panel}>
        <p className="text-xs tracking-[0.2em] text-white/45">SUPPORT & MAINTENANCE</p>
        <p className="mt-4 text-sm text-white/55">Loading the work ledger…</p>
      </section>
    );
  }

  if (!tracker) return null;
  const { plan, summary } = tracker;
  const graceWindowStatus = !plan.launch_at
    ? 'Starts when the official launch date is recorded'
    : summary.grace_ends_at && Date.now() <= summary.grace_ends_at
      ? `Active through ${new Date(summary.grace_ends_at).toLocaleDateString()}`
      : `Ended ${summary.grace_ends_at ? new Date(summary.grace_ends_at).toLocaleDateString() : '—'}`;

  return (
    <section className={panel}>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs tracking-[0.2em] text-white/45">SUPPORT & MAINTENANCE</p>
          <h2 className="mt-2 text-2xl font-light">Project work ledger</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">
            Every push to <span className="font-mono text-white/75">main</span> is logged with
            its commit, change totals, and an initial effort estimate. An administrator reviews
            the estimate before any hours are applied.
          </p>
        </div>
        <button
          className={secondaryButton}
          disabled={loading || working}
          onClick={() => void loadTracker()}
          type="button"
        >
          {loading ? 'REFRESHING…' : 'REFRESH LEDGER'}
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-sky-400/25 bg-sky-400/[0.06] p-5">
          <p className="text-[10px] tracking-[0.18em] text-sky-100/60">FUTURE-WORK BANK</p>
          <p className="mt-3 text-3xl font-light">{hours(summary.bank_remaining_hours)}</p>
          <p className="mt-2 text-xs leading-5 text-white/45">
            {hours(summary.bank_used_hours)} used of {hours(plan.bank_total_hours)} · $
            {plan.bank_value_dollars.toLocaleString()} at ${plan.hourly_rate}/hr
          </p>
        </div>
        <div className="border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
          <p className="text-[10px] tracking-[0.18em] text-emerald-100/60">BUG-FIX GRACE</p>
          <p className="mt-3 text-3xl font-light">{hours(summary.grace_remaining_hours)}</p>
          <p className="mt-2 text-xs leading-5 text-white/45">
            {hours(summary.grace_used_hours)} used of {hours(plan.grace_total_hours)} · separate
            from the paid bank
          </p>
        </div>
        <div className="border border-white/15 p-5">
          <p className="text-[10px] tracking-[0.18em] text-white/45">30-DAY WINDOW</p>
          <p className="mt-3 text-lg font-light">{graceWindowStatus}</p>
          <p className="mt-2 text-xs leading-5 text-white/45">
            Only launch-related bug fixes approved in this window count against the grace cap.
          </p>
        </div>
        <div className="border border-amber-400/25 bg-amber-400/[0.06] p-5">
          <p className="text-[10px] tracking-[0.18em] text-amber-100/60">NEEDS REVIEW</p>
          <p className="mt-3 text-3xl font-light">{summary.unreviewed_count}</p>
          <p className="mt-2 text-xs leading-5 text-white/45">
            Estimates do not reduce either balance until reviewed.
          </p>
        </div>
      </div>

      <form
        className="mt-6 flex flex-col gap-4 border border-white/15 p-5 sm:flex-row sm:items-end"
        onSubmit={saveLaunchDate}
      >
        <label className="w-full max-w-sm text-xs tracking-[0.14em] text-white/65">
          OFFICIAL LAUNCH DATE
          <input
            className={input}
            onChange={(event) => setLaunchDate(event.target.value)}
            type="date"
            value={launchDate}
          />
        </label>
        <button className={button} disabled={working} type="submit">
          SAVE LAUNCH DATE
        </button>
        {launchDate && (
          <button
            className={secondaryButton}
            disabled={working}
            onClick={() => setLaunchDate('')}
            type="button"
          >
            CLEAR FIELD
          </button>
        )}
      </form>

      <details className="mt-6 border border-white/15 p-5">
        <summary className="cursor-pointer text-sm tracking-[0.12em] text-white/75">
          LOG WORK MANUALLY
        </summary>
        <form className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-4" onSubmit={createEntry}>
          <label className="text-xs tracking-[0.14em] text-white/65 md:col-span-2">
            WORK TITLE
            <input className={input} maxLength={180} name="title" required type="text" />
          </label>
          <label className="text-xs tracking-[0.14em] text-white/65">
            ESTIMATE (HOURS)
            <input className={input} min="0.25" name="estimateHours" required step="0.25" type="number" />
          </label>
          <label className="text-xs tracking-[0.14em] text-white/65">
            WORK DATE
            <input className={input} name="occurredAt" required type="date" />
          </label>
          <label className="text-xs tracking-[0.14em] text-white/65">
            APPLY TO
            <select className={input} defaultValue="unreviewed" name="allocation">
              {Object.entries(allocationLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs tracking-[0.14em] text-white/65">
            APPLIED HOURS
            <input className={input} min="0.25" name="actualHours" step="0.25" type="number" />
          </label>
          <label className="text-xs tracking-[0.14em] text-white/65 md:col-span-2">
            DETAILS
            <textarea className={input} maxLength={3000} name="description" rows={3} />
          </label>
          <button className={button} disabled={working} type="submit">ADD WORK ENTRY</button>
        </form>
      </details>

      <div className="mt-6 grid gap-4">
        {tracker.entries.length === 0 ? (
          <p className="border border-white/10 p-5 text-sm text-white/50">
            No work has been logged yet. The next push to main will appear automatically.
          </p>
        ) : tracker.entries.map((entry) => (
          <article
            className={`border p-5 ${entry.voided_at ? 'border-red-400/25 opacity-55' : 'border-white/15'}`}
            key={entry.id}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`border px-2 py-1 text-[10px] tracking-[0.14em] ${allocationClasses(entry.allocation)}`}>
                    {entry.voided_at ? 'VOIDED' : allocationLabels[entry.allocation].toUpperCase()}
                  </span>
                  <span className="border border-white/15 px-2 py-1 text-[10px] tracking-[0.14em] text-white/45">
                    {entry.source.toUpperCase()}
                  </span>
                </div>
                <h3 className="mt-3 break-words text-lg font-normal">{entry.title}</h3>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  {dateTime(entry.occurred_at)} · estimate {hours(entry.estimate_hours)} · applied{' '}
                  {entry.actual_hours == null ? 'not reviewed' : hours(entry.actual_hours)}
                </p>
                {entry.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/60">{entry.description}</p>
                )}
                {entry.source === 'deployment' && (
                  <div className="mt-4 text-xs leading-5 text-white/45">
                    <p>
                      {entry.files_changed || 0} files · +{entry.additions || 0} / −{entry.deletions || 0}
                      {entry.author_name ? ` · ${entry.author_name}` : ''}
                    </p>
                    {entry.commit_url && (
                      <a
                        className="mt-1 inline-block break-all font-mono text-white/65 underline underline-offset-4 hover:text-white"
                        href={entry.commit_url}
                        rel="noreferrer"
                        target="_blank"
                      >
                        {entry.sha?.slice(0, 10)} ↗
                      </a>
                    )}
                    {entry.changed_files && entry.changed_files.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-white/60">VIEW CHANGED FILES</summary>
                        <ul className="mt-2 grid gap-1 font-mono text-[11px]">
                          {entry.changed_files.map((file) => (
                            <li className="break-all" key={file.path}>
                              +{file.additions} −{file.deletions} {file.path}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                {entry.voided_at && (
                  <p className="mt-3 text-xs text-red-200">Voided: {entry.void_reason || 'No reason recorded'}</p>
                )}
              </div>

              {!entry.voided_at && (
                <form
                  className="grid shrink-0 gap-3 border border-white/10 p-4 sm:grid-cols-2 lg:w-[520px]"
                  onSubmit={(event) => void updateEntry(event, entry.id)}
                >
                  <label className="text-[10px] tracking-[0.12em] text-white/55">
                    APPLY TO
                    <select className={input} defaultValue={entry.allocation} name="allocation">
                      {Object.entries(allocationLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[10px] tracking-[0.12em] text-white/55">
                    APPLIED HOURS
                    <input
                      className={input}
                      defaultValue={entry.actual_hours ?? entry.estimate_hours}
                      min="0.25"
                      name="actualHours"
                      required
                      step="0.25"
                      type="number"
                    />
                  </label>
                  <label className="text-[10px] tracking-[0.12em] text-white/55 sm:col-span-2">
                    REVIEW NOTES
                    <textarea
                      className={input}
                      defaultValue={entry.description || ''}
                      maxLength={3000}
                      name="description"
                      rows={2}
                    />
                  </label>
                  <button className={button} disabled={working} type="submit">SAVE REVIEW</button>
                  <button
                    className="border border-red-300/30 px-4 py-3 text-xs tracking-[0.14em] text-red-200 hover:border-red-200"
                    disabled={working}
                    onClick={() => void voidEntry(entry.id)}
                    type="button"
                  >
                    VOID ENTRY
                  </button>
                </form>
              )}
            </div>
          </article>
        ))}
      </div>

      <details className="mt-6 border border-white/15 p-5">
        <summary className="cursor-pointer text-sm tracking-[0.12em] text-white/75">
          ACTIVITY HISTORY ({tracker.audit.length})
        </summary>
        <div className="mt-4 grid gap-3">
          {tracker.audit.map((event) => (
            <div className="border-t border-white/10 pt-3 text-xs leading-5 text-white/50" key={event.id}>
              <p>
                <span className="text-white/75">{event.action.replaceAll('_', ' ')}</span> ·{' '}
                {dateTime(event.occurred_at)} · {event.actor_email || 'deployment automation'}
              </p>
              {event.details && (
                <p className="mt-1 break-words font-mono text-[11px] text-white/35">
                  {JSON.stringify(event.details)}
                </p>
              )}
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}

export function AdminAccessPage() {
  const [authReady, setAuthReady] = useState(false);
  const [admin, setAdmin] = useState<User | null>(null);
  const [authError, setAuthError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [events, setEvents] = useState<AccessEvent[]>([]);
  const [mirror, setMirror] = useState<MirrorStatus>({ count: 0 });
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackCursor, setFeedbackCursor] = useState<string | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [expiresAt, setExpiresAt] = useState(defaultExpiration);

  useEffect(() => {
    let unsubscribe = () => {};
    let active = true;
    try {
      const { auth, persistenceReady } = getFirebaseServices();
      void persistenceReady.then(() => {
        if (!active) return;
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!active) return;
          if (!user) {
            setAdmin(null);
            setAuthReady(true);
            return;
          }
          try {
            let token = await user.getIdTokenResult(true);
            if (token.claims.admin !== true) {
              await callFirebaseFunction<Record<string, never>, { authorized: boolean }>(
                'claimAdminAccess',
                {},
              );
              token = await user.getIdTokenResult(true);
            }
            if (token.claims.admin !== true) {
              throw new Error('This Firebase account has not been granted the admin role.');
            }
            setAuthError('');
            setAdmin(user);
          } catch (error) {
            await signOut(auth).catch(() => undefined);
            setAuthError(firebaseErrorMessage(error, 'Administrator verification failed.'));
            setAdmin(null);
          } finally {
            setAuthReady(true);
          }
        });
      });
    } catch (error) {
      setAuthError(firebaseErrorMessage(error, 'Firebase is not configured.'));
      setAuthReady(true);
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const [grantResult, eventResult, mirrorResult] = await Promise.all([
        callFirebaseFunction<Record<string, never>, { grants: Grant[] }>(
          'listAccessGrants',
          {},
        ),
        callFirebaseFunction<{ limit: number }, { events: AccessEvent[] }>(
          'listAccessEvents',
          { limit: 200 },
        ),
        callFirebaseFunction<Record<string, never>, MirrorStatus>(
          'getShopifyMirrorStatus',
          {},
        ),
      ]);
      setGrants(grantResult.grants);
      setEvents(eventResult.events);
      setMirror(mirrorResult);
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The admin dashboard could not be loaded.'));
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const loadFeedback = useCallback(async (after?: string | null) => {
    setFeedbackLoading(true);
    try {
      const result = await callFirebaseFunction<
        { after?: string; limit: number },
        { feedback: FeedbackItem[]; nextCursor: string | null }
      >('listFeedback', {
        ...(after ? { after } : {}),
        limit: 50,
      });
      setFeedback((current) => (after ? [...current, ...result.feedback] : result.feedback));
      setFeedbackCursor(result.nextCursor);
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The feedback inbox could not be loaded.'));
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  useEffect(() => {
    if (admin) {
      void loadDashboard();
      void loadFeedback();
    }
  }, [admin, loadDashboard, loadFeedback]);

  const activeCount = useMemo(
    () => grants.filter((grant) => grantStatus(grant) === 'active').length,
    [grants],
  );

  async function emailSignIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setAuthError('');
    try {
      const { auth, persistenceReady } = getFirebaseServices();
      await persistenceReady;
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      setAuthError(firebaseErrorMessage(error, 'Administrator sign-in failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    setAuthError('');
    try {
      const { auth, persistenceReady } = getFirebaseServices();
      await persistenceReady;
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (error) {
      setAuthError(firebaseErrorMessage(error, 'Google sign-in failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function createGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    setGeneratedCode('');
    try {
      const result = await callFirebaseFunction<
        Record<string, FormDataEntryValue>,
        { code: string }
      >('createAccessGrant', values);
      setGeneratedCode(result.code);
      toast.success('Personal access code created.');
      form.reset();
      setExpiresAt(defaultExpiration());
      await loadDashboard();
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The access code could not be created.'));
    } finally {
      setBusy(false);
    }
  }

  async function revokeGrant(id: string) {
    if (!window.confirm('Revoke this personal access code immediately?')) return;
    try {
      await callFirebaseFunction<{ id: string }, { ok: boolean }>('revokeAccessGrant', {
        id,
      });
      toast.success('Access code revoked.');
      await loadDashboard();
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'The access code could not be revoked.'));
    }
  }

  async function synchronizeCustomers() {
    if (
      !window.confirm(
        'Copy the current Shopify customer profiles and tags into the protected Firebase mirror?',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = await callFirebaseFunction<
        Record<string, never>,
        { count: number; syncedAt: number }
      >('syncShopifyCustomers', {});
      toast.success(`${result.count.toLocaleString()} Shopify customers synchronized.`);
      await loadDashboard();
    } catch (error) {
      toast.error(firebaseErrorMessage(error, 'Shopify customers could not be synchronized.'));
    } finally {
      setBusy(false);
    }
  }

  async function openGuide(guide: AdminGuideId) {
    const guideWindow = window.open('', '_blank');
    if (!guideWindow) {
      toast.error('Allow pop-ups for this site, then open the guide again.');
      return;
    }
    guideWindow.opener = null;
    try {
      const result = await callFirebaseFunction<{ guide: string }, GuideResponse>(
        'getAdminGuide',
        { guide },
      );
      const objectUrl = URL.createObjectURL(
        new Blob([decodeBase64(result.base64)], { type: result.contentType }),
      );
      guideWindow.location.replace(objectUrl);
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10 * 60 * 1000);
    } catch (error) {
      guideWindow.close();
      toast.error(firebaseErrorMessage(error, 'The guide could not be opened.'));
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-black px-6 py-28 text-center text-white">
        <p className="text-xs tracking-[0.28em] text-white/60">VERIFYING FIREBASE ADMIN ACCESS…</p>
      </div>
    );
  }

  if (!admin) {
    return (
      <div className="min-h-screen bg-black px-5 py-16 text-white sm:py-24">
        <main className="mx-auto max-w-lg">
          <a className="text-xs tracking-[0.2em] text-white/60 hover:text-white" href="/">
            ← RETURN TO SITE
          </a>
          <section className={`${panel} mt-8`}>
            <p className="text-xs tracking-[0.25em] text-white/50">MANOIR KITS</p>
            <h1 className="mt-4 text-3xl font-light">Administrator sign-in</h1>
            <p className="mt-4 text-sm leading-6 text-white/60">
              Sign in with an approved owner Google account. The former shared administrator
              key is no longer accepted.
            </p>
            <button
              className={`${secondaryButton} mt-7 w-full`}
              disabled={busy}
              onClick={() => void googleSignIn()}
              type="button"
            >
              CONTINUE WITH GOOGLE
            </button>
            <div className="my-6 flex items-center gap-3 text-[10px] tracking-[0.2em] text-white/35">
              <span className="h-px flex-1 bg-white/15" />
              OR EMAIL
              <span className="h-px flex-1 bg-white/15" />
            </div>
            <form className="grid gap-4" onSubmit={emailSignIn}>
              <label className="text-xs tracking-[0.14em] text-white/70">
                EMAIL
                <input
                  autoComplete="username"
                  className={input}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label className="text-xs tracking-[0.14em] text-white/70">
                PASSWORD
                <input
                  autoComplete="current-password"
                  className={input}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>
              <button className={button} disabled={busy} type="submit">
                SIGN IN
              </button>
            </form>
            {authError && (
              <p className="mt-5 text-sm leading-6 text-red-200" role="alert">
                {authError}
              </p>
            )}
          </section>
        </main>
        <Toaster position="bottom-right" theme="dark" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black px-4 py-10 text-white sm:px-7">
      <header className="mx-auto flex max-w-[1500px] flex-col gap-4 border-b border-white/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs tracking-[0.25em] text-white/50">MANOIR KITS</p>
          <h1 className="mt-2 text-3xl font-light sm:text-4xl">Owner dashboard</h1>
          <p className="mt-2 text-sm text-white/50">
            Signed in as {admin.email || admin.displayName}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a className={secondaryButton} href="/">
            RETURN TO SITE
          </a>
          <button
            className={secondaryButton}
            onClick={() => void signOut(getFirebaseServices().auth)}
            type="button"
          >
            SIGN OUT
          </button>
        </div>
      </header>

      <main className="mx-auto mt-7 grid max-w-[1500px] gap-7">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={panel}>
            <p className="text-xs tracking-[0.2em] text-white/45">ACTIVE CODES</p>
            <p className="mt-3 text-4xl font-light">{activeCount.toLocaleString()}</p>
          </div>
          <div className={panel}>
            <p className="text-xs tracking-[0.2em] text-white/45">SHOPIFY MIRROR</p>
            <p className="mt-3 text-4xl font-light">{mirror.count.toLocaleString()}</p>
          </div>
          <div className={panel}>
            <p className="text-xs tracking-[0.2em] text-white/45">LAST FULL SYNC</p>
            <p className="mt-3 text-lg font-light">{dateTime(mirror.last_full_sync_at)}</p>
          </div>
          <div className={panel}>
            <p className="text-xs tracking-[0.2em] text-white/45">FEEDBACK LOADED</p>
            <p className="mt-3 text-4xl font-light">{feedback.length.toLocaleString()}</p>
          </div>
        </section>

        <SupportTrackerSection />

        <section className={panel}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs tracking-[0.2em] text-white/45">CUSTOMER MESSAGES</p>
              <h2 className="mt-2 text-2xl font-light">Shopify inbox</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
                Website feedback and contact messages are collected here from private Shopify
                records so they stay organized in one owner-only place.
              </p>
            </div>
            <button
              className={secondaryButton}
              disabled={feedbackLoading}
              onClick={() => void loadFeedback()}
              type="button"
            >
              {feedbackLoading ? 'LOADING…' : 'REFRESH FEEDBACK'}
            </button>
          </div>

          {feedback.length === 0 && !feedbackLoading ? (
            <p className="mt-6 border border-white/10 p-5 text-sm text-white/50">
              No feedback has been submitted yet.
            </p>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {feedback.map((item) => (
                <article className="border border-white/15 p-5" key={item.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {item.rating ? (
                      <span
                        aria-label={`${item.rating} out of 5 stars`}
                        className="tracking-[0.12em] text-amber-200"
                      >
                        {'★'.repeat(item.rating)}
                        <span className="text-white/20">{'☆'.repeat(5 - item.rating)}</span>
                      </span>
                    ) : (
                      <span className="text-xs tracking-[0.14em] text-white/50">
                        CONTACT MESSAGE
                      </span>
                    )}
                    <span className="border border-white/20 px-2 py-1 text-[10px] tracking-[0.14em] text-white/60">
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                  <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-white/85">
                    {item.message}
                  </p>
                  <dl className="mt-5 grid gap-2 border-t border-white/10 pt-4 text-xs text-white/50">
                    <div className="flex flex-wrap gap-2">
                      <dt className="tracking-[0.12em] text-white/35">FROM</dt>
                      <dd className="text-white/65">
                        {[item.name, item.email].filter(Boolean).join(' · ') || 'anonymous'}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="tracking-[0.12em] text-white/35">CATEGORY</dt>
                      <dd className="text-white/65">{item.category.replaceAll('-', ' ')}</dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="tracking-[0.12em] text-white/35">PAGE</dt>
                      <dd className="break-all text-white/65">{item.page}</dd>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <dt className="tracking-[0.12em] text-white/35">RECEIVED</dt>
                      <dd className="text-white/65">{feedbackDateTime(item.submitted_at)}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          )}

          {feedbackCursor && (
            <button
              className={`${secondaryButton} mt-5`}
              disabled={feedbackLoading}
              onClick={() => void loadFeedback(feedbackCursor)}
              type="button"
            >
              LOAD OLDER FEEDBACK
            </button>
          )}
        </section>

        <section className={panel}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs tracking-[0.2em] text-white/45">CUSTOMER BACKUP</p>
              <h2 className="mt-2 text-2xl font-light">Shopify customer mirror</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
                Copies customer IDs, names, email addresses, and access tags into protected
                Firestore records. Shopify remains authoritative for sign-in, orders, and checkout.
              </p>
            </div>
            <button
              className={button}
              disabled={busy}
              onClick={() => void synchronizeCustomers()}
              type="button"
            >
              SYNC ALL CUSTOMERS
            </button>
          </div>
        </section>

        <section className={panel}>
          <p className="text-xs tracking-[0.2em] text-white/45">OWNER REFERENCE</p>
          <h2 className="mt-2 text-2xl font-light">Operations guides</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/55">
            Every owner guide is kept here and only opens after administrator sign-in.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {adminGuides.map((guide) => (
              <button
                className="border border-white/15 p-5 text-left transition hover:border-white/50"
                key={guide.id}
                onClick={() => void openGuide(guide.id)}
                type="button"
              >
                <span className="text-xs tracking-[0.18em] text-white/45">
                  {guide.category}
                </span>
                <strong className="mt-3 block text-lg font-normal">{guide.title}</strong>
                <span className="mt-3 block text-sm leading-6 text-white/50">
                  {guide.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className={panel}>
          <p className="text-xs tracking-[0.2em] text-white/45">ISSUE ACCESS</p>
          <h2 className="mt-2 text-2xl font-light">Create a personal code</h2>
          <form className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" onSubmit={createGrant}>
            <label className="text-xs tracking-[0.14em] text-white/65">
              PERSON OR ORGANIZATION
              <input className={input} maxLength={120} name="label" required type="text" />
            </label>
            <label className="text-xs tracking-[0.14em] text-white/65">
              EMAIL
              <input className={input} maxLength={180} name="email" type="email" />
            </label>
            <label className="text-xs tracking-[0.14em] text-white/65">
              CODE TYPE
              <select className={input} name="role">
                <option value="visitor">Private visitor</option>
                <option value="footballer">Footballer</option>
                <option value="admin">Owner</option>
              </select>
            </label>
            <label className="text-xs tracking-[0.14em] text-white/65">
              EXPIRES
              <input
                className={input}
                name="expiresAt"
                onChange={(event) => setExpiresAt(event.target.value)}
                required
                type="datetime-local"
                value={expiresAt}
              />
            </label>
            <label className="text-xs tracking-[0.14em] text-white/65">
              SIGN-IN LIMIT
              <input className={input} defaultValue={25} max={500} min={1} name="maxUses" required type="number" />
            </label>
            <label className="text-xs tracking-[0.14em] text-white/65">
              UNIQUE NETWORK LIMIT
              <input className={input} defaultValue={3} max={50} min={1} name="maxIps" required type="number" />
            </label>
            <label className="text-xs tracking-[0.14em] text-white/65 sm:col-span-2 lg:col-span-3">
              INTERNAL NOTES
              <textarea className={input} maxLength={500} name="notes" rows={3} />
            </label>
            <button className={`${button} sm:col-span-2 lg:col-span-1`} disabled={busy} type="submit">
              GENERATE CODE
            </button>
          </form>
          {generatedCode && (
            <div className="mt-6 flex flex-col gap-4 border border-emerald-400/40 bg-emerald-400/10 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs tracking-[0.18em] text-emerald-100/70">
                  NEW PERSONAL CODE
                </span>
                <strong className="mt-2 block break-all font-mono text-lg font-normal text-emerald-100">
                  {generatedCode}
                </strong>
              </div>
              <button
                className={secondaryButton}
                onClick={() => {
                  void navigator.clipboard.writeText(generatedCode);
                  toast.success('Code copied.');
                }}
                type="button"
              >
                COPY
              </button>
            </div>
          )}
        </section>

        <section className={panel}>
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-white/45">ACCESS CODES</p>
              <h2 className="mt-2 text-2xl font-light">Personal grants</h2>
            </div>
            <button className={secondaryButton} disabled={dashboardLoading} onClick={() => void loadDashboard()} type="button">
              REFRESH
            </button>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="text-xs tracking-[0.12em] text-white/45">
                <tr className="border-b border-white/15">
                  <th className="px-3 py-4 font-normal">PERSON</th>
                  <th className="px-3 py-4 font-normal">TYPE</th>
                  <th className="px-3 py-4 font-normal">USES</th>
                  <th className="px-3 py-4 font-normal">LAST USED</th>
                  <th className="px-3 py-4 font-normal">EXPIRES</th>
                  <th className="px-3 py-4 font-normal">STATUS</th>
                  <th className="px-3 py-4" />
                </tr>
              </thead>
              <tbody>
                {grants.map((grant) => {
                  const status = grantStatus(grant);
                  return (
                    <tr className="border-b border-white/10 text-white/70" key={grant.id}>
                      <td className="px-3 py-4">
                        <span className="block text-white">{grant.label}</span>
                        <span className="text-xs text-white/40">{grant.email || '—'}</span>
                      </td>
                      <td className="px-3 py-4">{grant.role}</td>
                      <td className="px-3 py-4">
                        {grant.use_count}/{grant.max_uses} · {grant.max_ips} networks
                      </td>
                      <td className="px-3 py-4">{dateTime(grant.last_used_at)}</td>
                      <td className="px-3 py-4">{dateTime(grant.expires_at)}</td>
                      <td className="px-3 py-4">
                        <span className={`inline-block border px-2 py-1 text-xs ${statusClasses(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-4">
                        {status === 'active' && (
                          <button
                            className="text-xs tracking-[0.12em] text-red-200 hover:text-red-100"
                            onClick={() => void revokeGrant(grant.id)}
                            type="button"
                          >
                            REVOKE
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={panel}>
          <p className="text-xs tracking-[0.2em] text-white/45">SECURITY LOG</p>
          <h2 className="mt-2 text-2xl font-light">Recent access activity</h2>
          <p className="mt-3 text-sm leading-6 text-white/50">
            Connection and disclosed device data is retained for 30 days.
          </p>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[1100px] border-collapse text-left text-sm">
              <thead className="text-xs tracking-[0.12em] text-white/45">
                <tr className="border-b border-white/15">
                  <th className="px-3 py-4 font-normal">TIME</th>
                  <th className="px-3 py-4 font-normal">PERSON</th>
                  <th className="px-3 py-4 font-normal">RESULT</th>
                  <th className="px-3 py-4 font-normal">IP</th>
                  <th className="px-3 py-4 font-normal">LOCATION</th>
                  <th className="px-3 py-4 font-normal">BROWSER / DEVICE</th>
                  <th className="px-3 py-4 font-normal">PAGE</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr className="border-b border-white/10 align-top text-white/65" key={event.id}>
                    <td className="px-3 py-4">{dateTime(event.occurred_at)}</td>
                    <td className="px-3 py-4">{event.label || event.email || 'Unknown code'}</td>
                    <td className="px-3 py-4">
                      <span className={`inline-block border px-2 py-1 text-xs ${statusClasses(event.result)}`}>
                        {event.result.replaceAll('_', ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-4 font-mono text-xs">{event.ip}</td>
                    <td className="max-w-xs px-3 py-4">{locationSummary(event)}</td>
                    <td className="max-w-md px-3 py-4">{clientSummary(event)}</td>
                    <td className="px-3 py-4">{event.requested_path || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      <Toaster position="bottom-right" theme="dark" />
    </div>
  );
}
