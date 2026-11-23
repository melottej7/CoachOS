-- D-115 · Effacement d’un compte (RGPD). Le journal d’audit reste immuable, à une exception près : quand un compte est
-- supprimé dans une transaction d’effacement autorisée (coachos.erasure_authorized = on, rôle postgres ou service_role),
-- la clé étrangère met actor_id à null sur ses lignes d’audit. Rien d’autre ne peut changer : l’ancienne ligne, auteur
-- effacé, doit être identique à la nouvelle. Les suppressions autorisées restent celles de la version d’origine.

create or replace function private.block_mutation() returns trigger language plpgsql set search_path='' as $$
begin
 if current_user in ('postgres','service_role')
 and current_setting('coachos.erasure_authorized',true)='on' then
   if tg_op='DELETE' then
     return old;
   end if;
   if tg_op='UPDATE' and tg_table_name='audit_logs' and old.actor_id is not null and new.actor_id is null then
     old.actor_id := null;
     if new = old then
       return new;
     end if;
   end if;
 end if;
 raise exception 'immutable record' using errcode='23514';
end;
$$;
