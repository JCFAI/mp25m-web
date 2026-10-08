create or replace function
mp25m_api.save_economic_profile_revision(
  p_actor_internal_user_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_expected_revision_no integer,

  p_currency_code text,

  p_estimated_value numeric,
  p_estimated_costs numeric,
  p_probability_percent numeric,

  p_participant_income_potential numeric,
  p_mp25m_contribution_potential numeric,

  p_distribution_notes text,

  p_agreed_value numeric,

  p_collection_status text,
  p_collected_amount numeric,

  p_final_costs numeric,
  p_participant_income_final numeric,
  p_mp25m_contribution_final numeric,

  p_final_result_amount numeric,

  p_economic_summary text,
  p_evidence_reference text,

  p_rationale text
)
returns table (
  economic_profile_id uuid,
  revision_id uuid,
  revision_no integer
)
language plpgsql
security definer
set search_path =
  pg_catalog,
  mp25m,
  mp25m_api
as $function$
declare
  v_source_type text :=
    lower(
      btrim(
        coalesce(
          p_source_type,
          ''
        )
      )
    );

  v_currency_code text :=
    nullif(
      upper(
        btrim(
          coalesce(
            p_currency_code,
            ''
          )
        )
      ),
      ''
    );

  v_collection_status text :=
    nullif(
      lower(
        btrim(
          coalesce(
            p_collection_status,
            ''
          )
        )
      ),
      ''
    );

  v_distribution_notes text :=
    nullif(
      btrim(
        coalesce(
          p_distribution_notes,
          ''
        )
      ),
      ''
    );

  v_economic_summary text :=
    nullif(
      btrim(
        coalesce(
          p_economic_summary,
          ''
        )
      ),
      ''
    );

  v_evidence_reference text :=
    nullif(
      btrim(
        coalesce(
          p_evidence_reference,
          ''
        )
      ),
      ''
    );

  v_rationale text :=
    btrim(
      coalesce(
        p_rationale,
        ''
      )
    );

  v_profile
    mp25m.economic_profiles%rowtype;

  v_current_revision
    mp25m.economic_profile_revisions%rowtype;

  v_new_revision
    mp25m.economic_profile_revisions%rowtype;

  v_revision_no integer;

  v_action text;

  v_old_data jsonb;
begin
  if v_source_type not in (
    'opportunity',
    'articulation',
    'project'
  ) then
    raise exception
      'Invalid economic profile source type'
      using errcode = '22023';
  end if;


  if p_source_id is null then
    raise exception
      'Economic profile source id is required'
      using errcode = '22023';
  end if;


  if v_source_type = 'opportunity'
     and not exists (
       select 1
       from mp25m.opportunities opportunity
       where opportunity.id =
         p_source_id
     )
  then
    raise exception
      'Opportunity not found'
      using errcode = 'P0002';

  elsif v_source_type = 'articulation'
     and not exists (
       select 1
       from mp25m.opportunity_articulations articulation
       where articulation.id =
         p_source_id
     )
  then
    raise exception
      'Articulation not found'
      using errcode = 'P0002';

  elsif v_source_type = 'project'
     and not exists (
       select 1
       from mp25m.projects project
       where project.id =
         p_source_id
     )
  then
    raise exception
      'Project not found'
      using errcode = 'P0002';
  end if;


  if not mp25m_api.can_manage_economic_source(
    p_actor_internal_user_id,
    v_source_type,
    p_source_id
  ) then
    raise exception
      'Actor cannot manage economic profile'
      using errcode = '42501';
  end if;


  if p_expected_revision_no is null
     or p_expected_revision_no < 0
  then
    raise exception
      'Expected economic revision number is required'
      using errcode = '22023';
  end if;


  if v_currency_code is not null
     and v_currency_code !~ '^[A-Z]{3}$'
  then
    raise exception
      'Currency code must contain three uppercase letters'
      using errcode = '22023';
  end if;


  if p_estimated_value is not null
     and p_estimated_value < 0
  then
    raise exception
      'Estimated value cannot be negative'
      using errcode = '22023';
  end if;


  if p_estimated_costs is not null
     and p_estimated_costs < 0
  then
    raise exception
      'Estimated costs cannot be negative'
      using errcode = '22023';
  end if;


  if p_probability_percent is not null
     and (
       p_probability_percent < 0
       or p_probability_percent > 100
     )
  then
    raise exception
      'Probability must be between 0 and 100'
      using errcode = '22023';
  end if;


  if p_participant_income_potential is not null
     and p_participant_income_potential < 0
  then
    raise exception
      'Potential participant income cannot be negative'
      using errcode = '22023';
  end if;


  if p_mp25m_contribution_potential is not null
     and p_mp25m_contribution_potential < 0
  then
    raise exception
      'Potential MP25M contribution cannot be negative'
      using errcode = '22023';
  end if;


  if p_agreed_value is not null
     and p_agreed_value < 0
  then
    raise exception
      'Agreed value cannot be negative'
      using errcode = '22023';
  end if;


  if p_collected_amount is not null
     and p_collected_amount < 0
  then
    raise exception
      'Collected amount cannot be negative'
      using errcode = '22023';
  end if;


  if p_final_costs is not null
     and p_final_costs < 0
  then
    raise exception
      'Final costs cannot be negative'
      using errcode = '22023';
  end if;


  if p_participant_income_final is not null
     and p_participant_income_final < 0
  then
    raise exception
      'Final participant income cannot be negative'
      using errcode = '22023';
  end if;


  if p_mp25m_contribution_final is not null
     and p_mp25m_contribution_final < 0
  then
    raise exception
      'Final MP25M contribution cannot be negative'
      using errcode = '22023';
  end if;


  if v_collection_status is not null
     and v_collection_status not in (
       'pending',
       'partial',
       'collected',
       'uncollectible',
       'cancelled',
       'not_applicable'
     )
  then
    raise exception
      'Invalid collection status'
      using errcode = '22023';
  end if;


  if v_distribution_notes is not null
     and char_length(v_distribution_notes)
       not between 3 and 10000
  then
    raise exception
      'Distribution notes must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;


  if v_economic_summary is not null
     and char_length(v_economic_summary)
       not between 3 and 10000
  then
    raise exception
      'Economic summary must contain between 3 and 10000 characters'
      using errcode = '22023';
  end if;


  if v_evidence_reference is not null
     and char_length(v_evidence_reference)
       not between 3 and 2000
  then
    raise exception
      'Evidence reference must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  if char_length(v_rationale)
     not between 3 and 2000
  then
    raise exception
      'Economic revision rationale must contain between 3 and 2000 characters'
      using errcode = '22023';
  end if;


  if (
    p_estimated_value is not null
    or p_estimated_costs is not null
    or p_participant_income_potential is not null
    or p_mp25m_contribution_potential is not null
    or p_agreed_value is not null
    or p_collected_amount is not null
    or p_final_costs is not null
    or p_participant_income_final is not null
    or p_mp25m_contribution_final is not null
    or p_final_result_amount is not null
  )
  and v_currency_code is null
  then
    raise exception
      'Currency is required when monetary values are informed'
      using errcode = '22023';
  end if;


  if
    v_currency_code is null
    and p_estimated_value is null
    and p_estimated_costs is null
    and p_probability_percent is null
    and p_participant_income_potential is null
    and p_mp25m_contribution_potential is null
    and v_distribution_notes is null
    and p_agreed_value is null
    and v_collection_status is null
    and p_collected_amount is null
    and p_final_costs is null
    and p_participant_income_final is null
    and p_mp25m_contribution_final is null
    and p_final_result_amount is null
    and v_economic_summary is null
    and v_evidence_reference is null
  then
    raise exception
      'Economic profile revision must contain economic information'
      using errcode = '22023';
  end if;


  if v_source_type = 'opportunity' then
    select profile.*
    into v_profile
    from mp25m.economic_profiles profile
    where profile.opportunity_id =
      p_source_id
    for update;

  elsif v_source_type = 'articulation' then
    select profile.*
    into v_profile
    from mp25m.economic_profiles profile
    where profile.articulation_id =
      p_source_id
    for update;

  else
    select profile.*
    into v_profile
    from mp25m.economic_profiles profile
    where profile.project_id =
      p_source_id
    for update;
  end if;


  if not found then
    if p_expected_revision_no <> 0 then
      raise sqlstate 'PT409'
      using message = 'Economic profile revision is stale';
    end if;

    begin
      insert into mp25m.economic_profiles (
        opportunity_id,
        articulation_id,
        project_id,
        created_by_internal_user_id
      )
      values (
        case
          when v_source_type = 'opportunity'
            then p_source_id
          else null
        end,

        case
          when v_source_type = 'articulation'
            then p_source_id
          else null
        end,

        case
          when v_source_type = 'project'
            then p_source_id
          else null
        end,

        p_actor_internal_user_id
      )
      returning *
      into v_profile;

    exception
      when unique_violation then
        raise sqlstate 'PT409'
      using message = 'Economic profile revision is stale';
    end;

    v_revision_no := 1;
    v_action := 'economic.profile.create';
    v_old_data := null;

  else
    select revision.*
    into v_current_revision
    from mp25m.economic_profile_revisions revision
    where revision.economic_profile_id =
      v_profile.id
    order by revision.revision_no desc
    limit 1;

    if not found then
      raise exception
        'Economic profile has no revision'
        using errcode = 'P0002';
    end if;

    if p_expected_revision_no <>
       v_current_revision.revision_no
    then
      raise sqlstate 'PT409'
      using message = 'Economic profile revision is stale';
    end if;

    v_revision_no :=
      v_current_revision.revision_no + 1;

    v_action :=
      'economic.profile.revise';

    v_old_data :=
      to_jsonb(v_current_revision)
      - 'id'
      - 'economic_profile_id'
      - 'changed_by_internal_user_id'
      - 'changed_at';
  end if;


  insert into mp25m.economic_profile_revisions (
    economic_profile_id,
    revision_no,

    currency_code,

    estimated_value,
    estimated_costs,
    probability_percent,

    participant_income_potential,
    mp25m_contribution_potential,

    distribution_notes,

    agreed_value,

    collection_status,
    collected_amount,

    final_costs,
    participant_income_final,
    mp25m_contribution_final,

    final_result_amount,

    economic_summary,
    evidence_reference,

    rationale,

    changed_by_internal_user_id
  )
  values (
    v_profile.id,
    v_revision_no,

    v_currency_code,

    p_estimated_value,
    p_estimated_costs,
    p_probability_percent,

    p_participant_income_potential,
    p_mp25m_contribution_potential,

    v_distribution_notes,

    p_agreed_value,

    v_collection_status,
    p_collected_amount,

    p_final_costs,
    p_participant_income_final,
    p_mp25m_contribution_final,

    p_final_result_amount,

    v_economic_summary,
    v_evidence_reference,

    v_rationale,

    p_actor_internal_user_id
  )
  returning *
  into v_new_revision;


  insert into mp25m.audit_events (
    actor_internal_user_id,
    action,
    target_schema,
    target_table,
    target_id,
    reason,
    old_data,
    new_data,
    result,
    metadata
  )
  values (
    p_actor_internal_user_id,
    v_action,
    'mp25m',
    'economic_profiles',
    v_profile.id,
    v_rationale,
    v_old_data,

    to_jsonb(v_new_revision)
      - 'id'
      - 'economic_profile_id'
      - 'changed_by_internal_user_id'
      - 'changed_at',

    'allowed',

    jsonb_build_object(
      'economic_profile_id',
        v_profile.id,
      'source_type',
        v_source_type,
      'source_id',
        p_source_id,
      'revision_id',
        v_new_revision.id,
      'revision_no',
        v_new_revision.revision_no
    )
  );


  economic_profile_id :=
    v_profile.id;

  revision_id :=
    v_new_revision.id;

  revision_no :=
    v_new_revision.revision_no;

  return next;
end;
$function$;
