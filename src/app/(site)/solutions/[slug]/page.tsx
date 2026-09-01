import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SOLUTIONS, solutionBySlug } from '../../content';
import { ContentPage } from '../../content-page';

export function generateStaticParams() {
  return SOLUTIONS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = solutionBySlug(slug);
  if (!s) return {};
  return { title: `${s.nav} — Travelgenix Trips`, description: s.lede };
}

export default async function SolutionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = solutionBySlug(slug);
  if (!s) notFound();
  return <ContentPage content={s} backHref="/solutions" backLabel="Who it is for" />;
}
