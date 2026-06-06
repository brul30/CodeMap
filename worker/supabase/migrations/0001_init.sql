-- =============================================================================
-- 0001_init.sql — CodeMap initial schema
--
-- Apply via:  Supabase Dashboard → SQL Editor → paste and run, OR
--             supabase db push  (if using the Supabase CLI with a linked project)
--
-- Idempotent: uses IF NOT EXISTS / ON CONFLICT DO NOTHING throughout.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- projects
-- Tracks one analysis job per repo per user.
-- Realtime is enabled so the frontend can subscribe to status changes.
-- ---------------------------------------------------------------------------

create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  repo        text not null,           -- "owner/repo" format
  status      text not null default 'queued'
                constraint projects_status_check
                check (status in ('queued', 'running', 'ready', 'error')),
  error_msg   text,                    -- populated when status = 'error'
  mermaid     text,                    -- reserved; may be used for diagram export
  created_at  timestamptz not null default now()
);

-- Full replica identity so Supabase Realtime broadcasts the complete row
-- (including old values) on UPDATE — needed to detect status transitions.
alter table projects replica identity full;

-- Add projects to the default realtime publication so subscribers receive
-- INSERT / UPDATE / DELETE events on this table. Guarded so re-running the
-- migration does not error if the table is already in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'projects'
  ) then
    alter publication supabase_realtime add table projects;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- nodes
-- One row per diagram node produced by the analysis pipeline.
-- `id` is the universal node_id shared by React Flow, the .md file,
-- the pre-rendered audio file, and the Pinecone vector metadata.
-- Primary key is composite because node ids are unique within a project,
-- not globally.
-- ---------------------------------------------------------------------------

create table if not exists nodes (
  -- Universal node identifier (React Flow node.id, Pinecone metadata.node_id, audio filename stem).
  -- Plain text, not a uuid — the worker assigns it deterministically from the repo structure.
  id              text not null,

  project_id      uuid not null
                    references projects (id)
                    on delete cascade,   -- deleting a project removes all its nodes

  label           text,
  type            text
                    constraint nodes_type_check
                    check (type in ('layer', 'service', 'module', 'external')),
  description     text,
  md_ref          text,                  -- path to the per-node .md file in Storage or repo
  parent          text,                  -- parent node_id (null = top-level)
  children        text[],               -- ordered child node_ids
  files           text[],               -- repo file paths belonging to this node
  position        jsonb,                 -- {x: number, y: number} set by dagre on the worker
  narration_text  text,                  -- plain-text script used to pre-render TTS audio
  audio_url       text,                  -- Supabase Storage URL of the pre-rendered MP3
  created_at      timestamptz not null default now(),

  -- Composite PK: node ids are unique per project, not globally.
  primary key (project_id, id)
);


-- ---------------------------------------------------------------------------
-- Storage — narration bucket
-- Private bucket for pre-rendered TTS MP3s (served via signed URLs).
-- The insert is idempotent: ON CONFLICT DO NOTHING means re-running this
-- migration will not error if the bucket already exists.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('narration', 'narration', false)
on conflict do nothing;
