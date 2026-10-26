import { useState } from 'react';
import type { FormEvent } from 'react';
import { BUILDING_MAX, submitAccessRequest, validateAccessRequest } from './accessRequest';
import type { AccessRequestErrors } from './accessRequest';

export function JoinForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [building, setBuilding] = useState('');
  const [errors, setErrors] = useState<AccessRequestErrors>({});
  const [busy, setBusy] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validateAccessRequest({ email, building });
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(errs.email ? 'join-email' : 'join-building')?.focus();
      return;
    }
    setBusy(true);
    setFailure('');
    const result = await submitAccessRequest({ email: email.trim(), building, website });
    setBusy(false);
    if (result.status === 'submitted') setDone(true);
    else if (result.status === 'rate_limited') setFailure('Too many attempts from your network. Please try again in a while.');
    else if (result.status === 'invalid') setFailure('We couldn’t accept that. Check your email address and description, then try again.');
    else setFailure('Something went wrong and your request was not saved. Please try again.');
  }

  if (done) {
    return (
      <div className="pub-form-done" role="status">
        <strong>Request received.</strong>
        <p>We’ve stored your interest. Access isn’t automatic: an admin reviews requests and may or may not get in touch. We haven’t sent you an email.</p>
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

      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="join-website">Leave this empty</label>
        <input id="join-website" name="website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {failure && <p className="pub-err" role="alert">{failure}</p>}

      <button type="submit" className="pub-btn" disabled={busy}>{busy ? 'Sending…' : 'Express interest'}</button>
      <p className="pub-sub">
        We store your email and answer so an admin can review your request. We don’t send marketing email, and this
        doesn’t create an account. Ask an admin to delete your request at any time.
      </p>
    </form>
  );
}
