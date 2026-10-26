import { useState } from 'react';
import type { FormEvent } from 'react';
import { BUILDING_MAX, submitAccessRequest, validateAccessRequest } from './accessRequest';
import type { AccessRequestErrors } from './accessRequest';

export function JoinForm() {
  const [email, setEmail] = useState('');
  const [building, setBuilding] = useState('');
  const [errors, setErrors] = useState<AccessRequestErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateAccessRequest({ email, building });
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(errs.email ? 'join-email' : 'join-building')?.focus();
      return;
    }
    setBusy(true);
    try { await submitAccessRequest({ email: email.trim(), building }); } finally { setBusy(false); }
    setDone(true);
  }

  if (done) {
    return (
      <div className="pub-form-done" role="status">
        <strong>Access requests aren’t open yet.</strong>
        <p>Nothing was sent or stored, so we don’t have your email. Check back soon.</p>
        <button type="button" className="pub-btn pub-btn--ghost" onClick={() => setDone(false)}>Back to the form</button>
      </div>
    );
  }

  return (
    <form className="pub-form" onSubmit={onSubmit} noValidate>
      <label htmlFor="join-email">Email</label>
      <input id="join-email" type="email" autoComplete="email" inputMode="email" placeholder="you@company.dev"
        value={email} onChange={(e) => setEmail(e.target.value)}
        aria-invalid={!!errors.email} aria-describedby={errors.email ? 'join-email-err' : undefined} />
      {errors.email && <p id="join-email-err" className="pub-err">{errors.email}</p>}

      <label htmlFor="join-building">What are you building with agents? <span>(optional)</span></label>
      <textarea id="join-building" rows={3} value={building} onChange={(e) => setBuilding(e.target.value)}
        aria-invalid={!!errors.building} aria-describedby={errors.building ? 'join-building-err' : undefined}
        placeholder="Claude Code, 37 terminals, a lot of tabs…" maxLength={BUILDING_MAX + 50} />
      {errors.building && <p id="join-building-err" className="pub-err">{errors.building}</p>}

      <button type="submit" className="pub-btn" disabled={busy}>{busy ? 'Requesting…' : 'Request access'}</button>
    </form>
  );
}
