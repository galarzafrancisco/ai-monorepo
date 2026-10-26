import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AccessRequestsService } from './api';
import {
  BUILDING_MAX,
  EMAIL_MAX,
  FAILURE_MESSAGES,
  HEARD_FROM_OPTIONS,
  HEARD_FROM_OTHER_MAX,
  submitAccessRequest,
  validateAccessRequest,
} from './accessRequest';
import type { AccessRequestErrors, AccessRequestSender, HeardFrom } from './accessRequest';

const sendToTaico: AccessRequestSender = (body) => AccessRequestsService.AccessRequestsController_create({ body });

export function JoinForm({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [building, setBuilding] = useState('');
  const [heardFrom, setHeardFrom] = useState<HeardFrom>('');
  const [heardFromOther, setHeardFromOther] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [errors, setErrors] = useState<AccessRequestErrors>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState('');
  const inFlight = useRef(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (inFlight.current) return;
    const errs = validateAccessRequest({ email, building, heardFrom, heardFromOther });
    setErrors(errs);
    if (Object.keys(errs).length) {
      const first = errs.email ? 'join-email' : errs.building ? 'join-building' : 'join-heard-from-other';
      document.getElementById(first)?.focus();
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setFailure('');
    const result = await submitAccessRequest({ email, building, heardFrom, heardFromOther, website }, sendToTaico);
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
        placeholder="e.g. three Claude Code sessions on a Rails monolith, one of them reviewing the others" maxLength={BUILDING_MAX + 50} />
      {errors.building && <p id="join-building-err" className="pub-err">{errors.building}</p>}

      <label htmlFor="join-heard-from">Where did you hear about Taico? <span>(optional)</span></label>
      <select id="join-heard-from" value={heardFrom} disabled={busy}
        onChange={(e) => {
          const next = e.target.value as HeardFrom;
          setHeardFrom(next);
          // Leaving "Other" discards what was typed so it is never sent by mistake.
          if (next !== 'other') {
            setHeardFromOther('');
            setErrors((prev) => ({ ...prev, heardFromOther: undefined }));
          }
        }}>
        <option value="">Choose one</option>
        {HEARD_FROM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {heardFrom === 'other' && (
        <>
          <label htmlFor="join-heard-from-other">Where? <span>(optional)</span></label>
          <input id="join-heard-from-other" type="text" autoComplete="off" value={heardFromOther} disabled={busy}
            onChange={(e) => setHeardFromOther(e.target.value)} maxLength={HEARD_FROM_OTHER_MAX + 20}
            placeholder="A podcast, a newsletter, a friend’s demo…"
            aria-invalid={!!errors.heardFromOther}
            aria-describedby={errors.heardFromOther ? 'join-heard-from-other-err' : undefined} />
          {errors.heardFromOther && <p id="join-heard-from-other-err" className="pub-err">{errors.heardFromOther}</p>}
        </>
      )}

      <div aria-hidden="true" className="pub-hp">
        <label htmlFor="join-website">Leave this empty</label>
        <input id="join-website" name="website" type="text" tabIndex={-1} autoComplete="off"
          value={website} onChange={(e) => setWebsite(e.target.value)} />
      </div>

      {failure && <p className="pub-err" role="alert">{failure}</p>}

      <button type="submit" className="pub-btn" disabled={busy}>{busy ? 'Sending…' : 'Request early access'}</button>
      <p className="pub-sub pub-privacy">
        We store your email and answers only so the Taico team can review your request. This doesn’t create an
        account, and we won’t add you to a mailing list. Want it deleted? Just ask and we’ll remove it.
      </p>
    </form>
  );
}
