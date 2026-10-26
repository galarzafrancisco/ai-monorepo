import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AccessRequestsService } from './api';
import {
  BUILDING_MAX,
  EMAIL_MAX,
  FAILURE_MESSAGES,
  submitAccessRequest,
  validateAccessRequest,
} from './accessRequest';
import type { AccessRequestErrors, AccessRequestSender } from './accessRequest';

const sendToTaico: AccessRequestSender = (body) => AccessRequestsService.AccessRequestsController_create({ body });

export function JoinForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [building, setBuilding] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [errors, setErrors] = useState<AccessRequestErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState('');
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const errs = validateAccessRequest({ email, building });
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(errs.email ? 'join-email' : 'join-building')?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFailure('');
    const result = await submitAccessRequest({ email, building, website }, sendToTaico);
    inFlight.current = false;
    setBusy(false);
    if (result.status === 'submitted') setDone(true);
    else setFailure(FAILURE_MESSAGES[result.status]);
  }

  if (done) {
    return (
      <div className="pub-form-done" role="status">
        <strong>Request received.</strong>
        <p>
          We’ve saved your interest for {email.trim()}. If you’d already sent one, we’ve updated it, so there’s no
          need to send it again. Access isn’t automatic: someone on the Taico team reviews requests and will be in
          touch if there’s a fit.
        </p>
      </div>
    );
  }

  return (
    <form className="pub-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
      <label htmlFor="join-email">Email</label>
      <input id="join-email" type="email" autoComplete="email" inputMode="email" placeholder="you@company.dev"
        value={email} onChange={(e) => setEmail(e.target.value)} maxLength={EMAIL_MAX + 10} disabled={busy}
        aria-invalid={!!errors.email} aria-describedby={errors.email ? 'join-email-err' : undefined} />
      {errors.email && <p id="join-email-err" className="pub-err">{errors.email}</p>}

      <label htmlFor="join-building">What are you building with agents? <span>(optional)</span></label>
      <textarea id="join-building" rows={3} value={building} onChange={(e) => setBuilding(e.target.value)} disabled={busy}
        aria-invalid={!!errors.building} aria-describedby={errors.building ? 'join-building-err' : undefined}
        placeholder="Claude Code, 37 terminals, a lot of tabs…" maxLength={BUILDING_MAX + 50} />
      {errors.building && <p id="join-building-err" className="pub-err">{errors.building}</p>}

      <div aria-hidden="true" className="pub-hp">
        <label htmlFor="join-website">Leave this empty</label>
        <input id="join-website" name="website" type="text" tabIndex={-1} autoComplete="off"
          value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {failure && <p className="pub-err" role="alert">{failure}</p>}

      <button type="submit" className="pub-btn" disabled={busy}>{busy ? 'Sending…' : 'Request access'}</button>
      <p className="pub-sub pub-privacy">
        We store your email and answer only so the Taico team can review your request. This doesn’t create an
        account, and we won’t add you to a mailing list. Want it deleted? Just ask and we’ll remove it.
      </p>
    </form>
  );
}
