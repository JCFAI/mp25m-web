create index if not exists idx_profile_review_items_submission on mp25m_private.profile_review_items(submission_id);
create index if not exists idx_profile_submissions_access_token on mp25m_private.profile_submissions(access_token_id);
create index if not exists idx_profile_submissions_ingestion_record on mp25m_private.profile_submissions(ingestion_record_id);
create index if not exists idx_skill_suggestions_person on mp25m_private.skill_suggestions(person_id);
create index if not exists idx_skill_suggestions_category on mp25m_private.skill_suggestions(proposed_category_code);
create index if not exists idx_skill_suggestions_resolved_skill on mp25m_private.skill_suggestions(resolved_skill_id);
create index if not exists idx_skill_suggestions_submission on mp25m_private.skill_suggestions(submission_id);;
