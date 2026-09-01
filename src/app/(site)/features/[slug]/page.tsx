import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FEATURES, featureBySlug } from '../../content';
import { ContentPage } from '../../content-page';

export function generateStaticParams() {
  return FEATURES.map((f) => ({ slug: f.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const f = featureBySlug(slug);
  if (!f) return {};
  return { title: `${f.nav} — Travelgenix Trips`, description: f.lede };
}

export default async function FeaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const f = featureBySlug(slug);
  if (!f) notFound();
  return <ContentPage content={f} backHref="/features" backLabel="Features" />;
}
