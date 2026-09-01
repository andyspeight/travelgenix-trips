import Link from 'next/link';
import { Icon, IconCheck, IconArrow } from './site-chrome';
import { Mockup } from './mockups';
import type { PageContent } from './content';

// The index listing for /features and /solutions: a header plus a card grid.
export function CardIndex({
  heading, intro, items, base,
}: { heading: string; intro: string; items: PageContent[]; base: string }) {
  return (
    <>
      <section className="m-phero">
        <div className="m-wrap"><h1>{heading}</h1><p>{intro}</p></div>
      </section>
      <section className="m-sec">
        <div className="m-wrap">
          <div className="m-cards">
            {items.map((it) => (
              <Link className="m-card" href={`${base}/${it.slug}`} key={it.slug}>
                <div className="m-card-ic"><Icon name={it.icon} size={20} /></div>
                <h3>{it.nav} <span className="m-card-go"><IconArrow size={16} /></span></h3>
                <p>{it.card}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="m-band">
        <div className="m-wrap m-band-in">
          <h2>See it with your own trips</h2>
          <p>Book a short demo and we will set up your first trip page with you.</p>
          <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
        </div>
      </section>
    </>
  );
}

export function ContentPage({
  content, backHref, backLabel,
}: { content: PageContent; backHref: string; backLabel: string }) {
  return (
    <>
      <section className="m-phero">
        <div className="m-wrap">
          <p style={{ margin: '0 0 14px' }}>
            <Link className="m-btn m-btn--plain" href={backHref} style={{ padding: 0 }}>← {backLabel}</Link>
          </p>
          <h1>{content.title}</h1>
          <p>{content.lede}</p>
          <div className="m-hero-cta">
            <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
            <Link className="m-btn m-btn--ghost m-btn--lg" href="/pricing">See pricing <IconArrow /></Link>
          </div>
        </div>
      </section>

      {content.splits.map((s, i) => (
        <section className={`m-split${i % 2 === 1 ? ' m-split--rev' : ''}`} key={s.title}>
          <div className="m-wrap">
            <div className="m-split-text">
              <h2>{s.title}</h2>
              <p>{s.body}</p>
              {s.points && (
                <ul>
                  {s.points.map((p) => (<li key={p}><IconCheck size={18} />{p}</li>))}
                </ul>
              )}
            </div>
            <div className="m-split-visual"><Mockup name={content.visuals?.[i] ?? content.visuals?.[0] ?? 'console'} /></div>
          </div>
        </section>
      ))}

      {content.benefits && content.benefits.length > 0 && (
        <section className="m-sec m-sec--paper">
          <div className="m-wrap">
            {content.benefitsHead && (
              <div className="m-sec-head"><h2>{content.benefitsHead}</h2></div>
            )}
            <div className="m-benefits">
              {content.benefits.map((b) => (
                <div className="m-benefit" key={b.title}>
                  <div className="m-benefit-ic"><Icon name={b.icon} size={20} /></div>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="m-band">
        <div className="m-wrap m-band-in">
          <h2>See it with your own trips</h2>
          <p>Book a short demo and we will set up your first trip page with you.</p>
          <Link className="m-btn m-btn--primary m-btn--lg" href="/demo">Book a demo</Link>
        </div>
      </section>
    </>
  );
}
