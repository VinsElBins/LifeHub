-- À exécuter une seule fois dans Supabase > SQL Editor > New query > Run
create table if not exists public.docs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key     text   not null,
  data    jsonb  not null,
  ts      bigint not null default 0,
  primary key (user_id, key)
);

alter table public.docs enable row level security;

create policy "docs_select_own" on public.docs for select to authenticated using ((select auth.uid()) = user_id);
create policy "docs_insert_own" on public.docs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "docs_update_own" on public.docs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "docs_delete_own" on public.docs for delete to authenticated using ((select auth.uid()) = user_id);
