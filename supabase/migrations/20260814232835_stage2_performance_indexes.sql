create index if not exists idx_skills_category on mp25m.skills(category_code);
create index if not exists idx_node_vectors_source on mp25m.node_vectors(source_id);
create index if not exists idx_person_vectors_node on mp25m.person_vectors(node_id);
create index if not exists idx_person_vectors_ingestion on mp25m.person_vectors(ingestion_record_id);;
