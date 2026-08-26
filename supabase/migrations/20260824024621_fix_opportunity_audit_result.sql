-- Incremento 2 - fix audit result values used by opportunity creation.
--
-- audit_events.result accepts:
-- allowed | rejected | error
--
-- The opportunity creation function incorrectly used "success".

do $$
declare
    v_signature regprocedure :=
        'mp25m_api.create_opportunity(uuid,text,text,text,text,text,text,date,uuid,uuid[],jsonb,jsonb)'::regprocedure;

    v_definition text;
    v_occurrences integer;
begin
    select pg_get_functiondef(v_signature)
    into v_definition;

    v_occurrences :=
        (
            char_length(v_definition)
            -
            char_length(
                replace(
                    v_definition,
                    '''success''',
                    ''
                )
            )
        )
        /
        char_length('''success''');

    if v_occurrences <> 2 then
        raise exception
            'Expected exactly 2 audit result literals "success"; found %',
            v_occurrences;
    end if;

    execute replace(
        v_definition,
        '''success''',
        '''allowed'''
    );
end;
$$;