-- One-off, not a migration: carries the original owner's hardcoded habits into the new habits table and copies
-- their old daily_logs columns (cigs, lift, core, cardio, steps) into the new daily_logs.habits column.
--
-- Safe to run more than once. It only adds what is missing: a habit that already exists by name is left alone, and
-- a day that already has a value for a habit keeps it. Run it after 20261005000400_habits.sql, and run it again
-- right after the new app is deployed, to pick up days the old app logged in the meantime.
--
-- Cardio: the old "Stairmaster" and "Badminton" answers become a yes with that word as the note.

do $$
declare
  owner_id uuid;
  owners integer;
  step_goal numeric;
  scope text;
begin
  select count(*) into owners from public.app_owner;
  if owners <> 1 then
    raise exception 'expected exactly one row in app_owner, found %', owners;
  end if;
  select user_id into owner_id from public.app_owner;

  select coalesce((select step_target from public.profile limit 1), 9000) into step_goal;

  insert into public.habits (user_id, name, kind, unit, goal, better, sort_order, created_at)
  select owner_id, v.name, v.kind, v.unit, v.goal, v.better, v.ord, now() + (v.ord || ' seconds')::interval
  from (values
    ('Cigarettes', 'count',  null::text,   0::numeric,         'lower',  0),
    ('Lift',       'yesno',  null::text,   null::numeric,      'higher', 1),
    ('Core',       'yesno',  null::text,   null::numeric,      'higher', 2),
    ('Cardio',     'yesno',  null::text,   null::numeric,      'higher', 3),
    ('Steps',      'amount', 'steps',      step_goal::numeric, 'higher', 4)
  ) as v(name, kind, unit, goal, better, ord)
  where not exists (select 1 from public.habits h where h.user_id = owner_id and h.name = v.name);

  -- once the per-user migration has run, only the owner's days are theirs to fill in
  scope := case
    when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'daily_logs' and column_name = 'user_id')
      then format('l.user_id = %L', owner_id)
    else 'true'
  end;

  execute format($sql$
    update public.daily_logs l
       set habits = l.habits || (
         select coalesce(jsonb_object_agg(h.id::text, e.entry), '{}'::jsonb)
           from public.habits h
          cross join lateral (
            select case h.name
              when 'Cigarettes' then case when l.cigs is null then null else jsonb_build_object('value', l.cigs) end
              when 'Lift' then case l.lift when 'yes' then jsonb_build_object('value', true) when 'no' then jsonb_build_object('value', false) end
              when 'Core' then case l.core when 'yes' then jsonb_build_object('value', true) when 'no' then jsonb_build_object('value', false) end
              when 'Cardio' then case l.cardio
                when 'yes' then jsonb_build_object('value', true, 'note', 'Stairmaster')
                when 'bad' then jsonb_build_object('value', true, 'note', 'Badminton')
                when 'no' then jsonb_build_object('value', false) end
              when 'Steps' then case when l.steps is null then null else jsonb_build_object('value', l.steps) end
            end as entry
          ) e
          where h.user_id = %L and e.entry is not null and not (l.habits ? h.id::text)
       )
     where %s
       and (l.cigs is not null or l.lift is not null or l.core is not null or l.cardio is not null or l.steps is not null)
  $sql$, owner_id, scope);
end
$$;
