'use client';
import { useState } from 'react';
import { contact, site } from '@/lib/content';
import Section from './Section';
import Eyebrow from '@/components/ui/Eyebrow';
import Reveal from '@/components/ui/Reveal';
import MagneticButton from '@/components/ui/MagneticButton';

// GitHub Pages serves static files only, so the form posts to Web3Forms.
// Replace with the real access key from web3forms.com (free).
const ACCESS_KEY = 'WEB3FORMS_ACCESS_KEY';

type Errors = Partial<Record<string, string>>;

export default function Contact() {
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const validate = (fd: FormData): Errors => {
    const e: Errors = {};
    for (const f of contact.fields) {
      const v = String(fd.get(f.name) ?? '').trim();
      if (f.required && !v) e[f.name] = `${f.label} is needed before I can reply.`;
      if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        e[f.name] = 'That email address is missing an @ or a domain.';
      }
    }
    return e;
  };

  const onSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const fd = new FormData(form);
    const found = validate(fd);
    setErrors(found);
    if (Object.keys(found).length) return;

    if (ACCESS_KEY === 'WEB3FORMS_ACCESS_KEY') {
      // No key configured yet, so hand off to email rather than silently losing the message.
      const body = contact.fields
        .map((f) => `${f.label}: ${fd.get(f.name) ?? ''}`)
        .join('\n\n');
      window.location.href =
        `mailto:${site.email}?subject=${encodeURIComponent('Website enquiry')}&body=${encodeURIComponent(body)}`;
      return;
    }

    setState('sending');
    fd.append('access_key', ACCESS_KEY);
    try {
      const res = await fetch('https://api.web3forms.com/submit', { method: 'POST', body: fd });
      setState(res.ok ? 'sent' : 'failed');
      if (res.ok) form.reset();
    } catch {
      setState('failed');
    }
  };

  return (
    <Section id="contact" alt>
      <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <Reveal><Eyebrow>{contact.eyebrow}</Eyebrow></Reveal>
          <Reveal delay={0.05}>
            <h2 className="font-display text-h2 font-bold text-paper">{contact.h2}</h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 max-w-prose text-body text-muted">{contact.body}</p>
          </Reveal>

          <Reveal delay={0.15}>
            <dl className="mt-12 space-y-4 border-t border-line pt-8">
              <div>
                <dt className="mono-label text-current">Email</dt>
                <dd><a href={`mailto:${site.email}`} className="text-body text-paper hover:text-signal">{site.email}</a></dd>
              </div>
              <div>
                <dt className="mono-label text-current">WhatsApp</dt>
                <dd className="text-body text-paper">{site.whatsapp}</dd>
              </div>
              <div>
                <dt className="mono-label text-current">Elsewhere</dt>
                <dd className="flex gap-4">
                  <a href={site.linkedin} target="_blank" rel="noopener noreferrer" className="text-body text-paper hover:text-signal">LinkedIn</a>
                  <a href={site.facebook} target="_blank" rel="noopener noreferrer" className="text-body text-paper hover:text-signal">Facebook</a>
                </dd>
              </div>
              <div>
                <dt className="mono-label text-current">Based in</dt>
                <dd className="text-body text-paper">{site.location}</dd>
              </div>
            </dl>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="glass p-6 sm:p-8">
            {state === 'sent' ? (
              <p role="status" className="text-body text-signal">{contact.success}</p>
            ) : (
              <form onSubmit={onSubmit} noValidate className="space-y-5">
                {contact.fields.map((f) => {
                  const err = errors[f.name];
                  const id = `f-${f.name}`;
                  return (
                    <div key={f.name}>
                      <label htmlFor={id} className="mono-label mb-2 block text-muted">
                        {f.label}
                      </label>
                      {f.type === 'textarea' ? (
                        <textarea
                          id={id} name={f.name} rows={4}
                          aria-invalid={!!err}
                          aria-describedby={err ? `${id}-err` : undefined}
                          className="w-full rounded-lg border border-line bg-[rgba(6,8,13,0.6)] px-4 py-3 text-body text-paper placeholder:text-muted focus:border-current"
                        />
                      ) : (
                        <input
                          id={id} name={f.name} type={f.type}
                          aria-invalid={!!err}
                          aria-describedby={err ? `${id}-err` : undefined}
                          className="w-full rounded-lg border border-line bg-[rgba(6,8,13,0.6)] px-4 py-3 text-body text-paper placeholder:text-muted focus:border-current"
                        />
                      )}
                      {err && (
                        <p id={`${id}-err`} className="mt-2 text-sm text-signal">{err}</p>
                      )}
                    </div>
                  );
                })}

                <MagneticButton type="submit" className="w-full justify-center">
                  {state === 'sending' ? 'Sending' : contact.button}
                </MagneticButton>

                {state === 'failed' && (
                  <p role="alert" className="text-sm text-signal">
                    That did not send. Email me directly at {site.email} and I will pick it up.
                  </p>
                )}
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
