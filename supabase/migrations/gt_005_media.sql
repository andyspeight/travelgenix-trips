-- gt_005_media.sql · the per-operator media library
-- Every uploaded image and video is recorded here so an operator can browse and
-- reuse their assets rather than re-uploading. The bytes live in Vercel Blob;
-- this stores only the https URL and metadata, same rule as everywhere else.
-- RLS on, no policies: service role only. Safe to re-run.

create table if not exists gt_media (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references gt_operators(id) on delete cascade,

  url           text not null,
  kind          text not null check (kind in ('image', 'video')),
  filename      text,
  content_type  text,
  size_bytes    bigint check (size_bytes >= 0),
  width         integer check (width >= 0),
  height        integer check (height >= 0),

  created_at    timestamptz not null default now()
);

comment on table gt_media is
  'An operator''s uploaded images and videos. The bytes are in Vercel Blob; this holds the URL and metadata so assets can be reused across trips.';

create index if not exists gt_media_operator_idx on gt_media (operator_id, created_at desc);
create unique index if not exists gt_media_operator_url_key on gt_media (operator_id, url);

alter table gt_media enable row level security;
alter table gt_media force row level security;
