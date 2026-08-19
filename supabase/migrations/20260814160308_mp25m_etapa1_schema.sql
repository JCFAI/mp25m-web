-- Sistema MP25M - Etapa 1
-- PostgreSQL
-- Modelo base para nodos, jurisdicciones, personas, roles, contactos,
-- consentimientos y trazabilidad de ingresos (Excel / WhatsApp / formularios / API).

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS mp25m;
SET search_path TO mp25m, public;

-- ---------------------------------------------------------------------------
-- Función común para updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mp25m.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. TERRITORIO
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS jurisdiction_types (
    code        varchar(30) PRIMARY KEY,
    name        varchar(80) NOT NULL UNIQUE,
    active      boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS jurisdictions (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type_code        varchar(30) NOT NULL REFERENCES jurisdiction_types(code) ON DELETE RESTRICT,
    name             varchar(150) NOT NULL,
    normalized_name  varchar(150) NOT NULL,
    parent_id        uuid NULL REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    official_code    varchar(50) NULL,
    latitude         numeric(9,6) NULL,
    longitude        numeric(10,6) NULL,
    active           boolean NOT NULL DEFAULT true,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT jurisdictions_not_self_parent
      CHECK (parent_id IS NULL OR parent_id <> id),
    CONSTRAINT jurisdictions_latitude_check
      CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT jurisdictions_longitude_check
      CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_jurisdictions_identity
ON jurisdictions (
    type_code,
    normalized_name,
    COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_normalized_name
ON jurisdictions(normalized_name);

CREATE INDEX IF NOT EXISTS idx_jurisdictions_parent
ON jurisdictions(parent_id);

CREATE TABLE IF NOT EXISTS jurisdiction_aliases (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id   uuid NOT NULL REFERENCES jurisdictions(id) ON DELETE CASCADE,
    alias             varchar(150) NOT NULL,
    normalized_alias  varchar(150) NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_jurisdiction_alias UNIQUE (jurisdiction_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_jurisdiction_aliases_normalized
ON jurisdiction_aliases(normalized_alias);

-- ---------------------------------------------------------------------------
-- 2. NODOS MP25M
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS nodes (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    node_number      integer NULL,
    name             varchar(150) NOT NULL,
    normalized_name  varchar(150) NOT NULL,
    slug             varchar(160) NOT NULL UNIQUE,
    description      text NULL,
    status           varchar(20) NOT NULL DEFAULT 'forming',
    started_on       date NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT nodes_number_positive
      CHECK (node_number IS NULL OR node_number > 0),
    CONSTRAINT nodes_status_check
      CHECK (status IN ('forming','active','inactive','archived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nodes_node_number
ON nodes(node_number)
WHERE node_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nodes_normalized_name
ON nodes(normalized_name);

CREATE TABLE IF NOT EXISTS node_jurisdictions (
    node_id          uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    jurisdiction_id  uuid NOT NULL REFERENCES jurisdictions(id) ON DELETE RESTRICT,
    is_primary       boolean NOT NULL DEFAULT false,
    coverage_notes   text NULL,
    created_at       timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (node_id, jurisdiction_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_node_primary_jurisdiction
ON node_jurisdictions(node_id)
WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_node_jurisdictions_jurisdiction
ON node_jurisdictions(jurisdiction_id);

CREATE TABLE IF NOT EXISTS node_aliases (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id           uuid NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
    alias             varchar(150) NOT NULL,
    normalized_alias  varchar(150) NOT NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_node_alias UNIQUE (node_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_node_aliases_normalized
ON node_aliases(normalized_alias);

-- ---------------------------------------------------------------------------
-- 3. PERSONAS Y CONTACTOS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS persons (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name           varchar(200) NOT NULL,
    first_name             varchar(100) NULL,
    last_name              varchar(120) NULL,
    normalized_name        varchar(220) NULL,
    primary_activity_text  text NULL,
    profession_text        text NULL,
    experience_text        text NULL,
    birth_date             date NULL,
    gender                 varchar(30) NULL,
    notes                  text NULL,
    record_status          varchar(20) NOT NULL DEFAULT 'active',
    merged_into_id         uuid NULL REFERENCES persons(id) ON DELETE RESTRICT,
    created_at             timestamptz NOT NULL DEFAULT now(),
    updated_at             timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT persons_record_status_check
      CHECK (record_status IN ('active','archived','merged')),
    CONSTRAINT persons_not_merged_into_self
      CHECK (merged_into_id IS NULL OR merged_into_id <> id),
    CONSTRAINT persons_merged_consistency
      CHECK (
        (record_status = 'merged' AND merged_into_id IS NOT NULL)
        OR
        (record_status <> 'merged' AND merged_into_id IS NULL)
      )
);

CREATE INDEX IF NOT EXISTS idx_persons_normalized_name
ON persons(normalized_name);

CREATE INDEX IF NOT EXISTS idx_persons_merged_into
ON persons(merged_into_id);

CREATE TABLE IF NOT EXISTS person_contacts (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id         uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    contact_type      varchar(20) NOT NULL,
    value_original    varchar(250) NOT NULL,
    value_normalized  varchar(250) NULL,
    label             varchar(80) NULL,
    is_primary        boolean NOT NULL DEFAULT false,
    visibility        varchar(20) NOT NULL DEFAULT 'private',
    verified_at       timestamptz NULL,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT person_contacts_type_check
      CHECK (contact_type IN ('email','phone','whatsapp','other')),
    CONSTRAINT person_contacts_visibility_check
      CHECK (visibility IN ('private','internal','public'))
);

CREATE INDEX IF NOT EXISTS idx_person_contacts_normalized
ON person_contacts(contact_type, value_normalized);

CREATE INDEX IF NOT EXISTS idx_person_contacts_person
ON person_contacts(person_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_person_primary_contact_type
ON person_contacts(person_id, contact_type)
WHERE is_primary = true;

-- No se declara UNIQUE global sobre teléfono/email:
-- puede haber teléfonos compartidos, centrales institucionales o datos todavía no depurados.

-- ---------------------------------------------------------------------------
-- 4. CONSENTIMIENTOS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS consent_types (
    code         varchar(50) PRIMARY KEY,
    name         varchar(120) NOT NULL UNIQUE,
    description  text NULL,
    active       boolean NOT NULL DEFAULT true
);

-- ---------------------------------------------------------------------------
-- 5. ROLES Y PARTICIPACIÓN EN NODOS
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    code         varchar(30) PRIMARY KEY,
    name         varchar(80) NOT NULL UNIQUE,
    description  text NULL,
    is_internal  boolean NOT NULL DEFAULT true,
    active       boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS node_participations (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id            uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
    node_id              uuid NOT NULL REFERENCES nodes(id) ON DELETE RESTRICT,
    status               varchar(20) NOT NULL DEFAULT 'active',
    verification_status  varchar(20) NOT NULL DEFAULT 'pending',
    started_on           date NULL,
    ended_on             date NULL,
    notes                text NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT node_participations_status_check
      CHECK (status IN ('active','inactive')),
    CONSTRAINT node_participations_verification_check
      CHECK (verification_status IN ('pending','confirmed','rejected')),
    CONSTRAINT node_participations_dates_check
      CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);

-- Una sola participación abierta por persona/nodo.
-- Si alguien sale y vuelve a incorporarse, puede existir un nuevo registro histórico.
CREATE UNIQUE INDEX IF NOT EXISTS uq_node_participation_open
ON node_participations(person_id, node_id)
WHERE ended_on IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_node_participations_node
ON node_participations(node_id);

CREATE INDEX IF NOT EXISTS idx_node_participations_person
ON node_participations(person_id);

CREATE INDEX IF NOT EXISTS idx_node_participations_verification
ON node_participations(verification_status);

CREATE TABLE IF NOT EXISTS node_participation_roles (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id     uuid NOT NULL REFERENCES node_participations(id) ON DELETE CASCADE,
    role_code            varchar(30) NOT NULL REFERENCES roles(code) ON DELETE RESTRICT,
    verification_status  varchar(20) NOT NULL DEFAULT 'pending',
    started_on           date NULL,
    ended_on             date NULL,
    notes                text NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT node_participation_roles_verification_check
      CHECK (verification_status IN ('pending','confirmed','rejected')),
    CONSTRAINT node_participation_roles_dates_check
      CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_node_participation_role_open
ON node_participation_roles(participation_id, role_code)
WHERE ended_on IS NULL;

CREATE INDEX IF NOT EXISTS idx_node_participation_roles_role
ON node_participation_roles(role_code);

-- ---------------------------------------------------------------------------
-- 6. TRAZABILIDAD DE INGRESOS
--    Sirve por igual para Excel, WhatsApp, formularios web, API o carga manual.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS data_sources (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name                varchar(250) NOT NULL,
    source_type         varchar(30) NOT NULL,
    description         text NULL,
    external_reference  text NULL,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT data_sources_type_check
      CHECK (source_type IN ('spreadsheet','whatsapp','form','manual','api','other'))
);

CREATE TABLE IF NOT EXISTS ingestion_batches (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id          uuid NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    original_filename  varchar(300) NULL,
    file_sha256        char(64) NULL,
    started_at         timestamptz NOT NULL DEFAULT now(),
    completed_at       timestamptz NULL,
    status             varchar(20) NOT NULL DEFAULT 'pending',
    total_records      integer NULL,
    metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes              text NULL,

    CONSTRAINT ingestion_batches_status_check
      CHECK (status IN ('pending','processing','completed','completed_with_errors','failed')),
    CONSTRAINT ingestion_batches_total_records_check
      CHECK (total_records IS NULL OR total_records >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_file_hash
ON ingestion_batches(source_id, file_sha256)
WHERE file_sha256 IS NOT NULL;

CREATE TABLE IF NOT EXISTS ingestion_records (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    source_id           uuid NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
    batch_id            uuid NULL REFERENCES ingestion_batches(id) ON DELETE RESTRICT,
    sheet_name          varchar(150) NULL,
    row_number          integer NULL,
    external_record_id  varchar(250) NULL,
    submitted_at        timestamptz NULL,
    raw_data            jsonb NOT NULL,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    fingerprint         char(64) NULL,
    processing_status   varchar(30) NOT NULL DEFAULT 'pending',
    error_message       text NULL,
    created_at          timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ingestion_records_status_check
      CHECK (processing_status IN (
        'pending',
        'parsed',
        'needs_review',
        'accepted',
        'rejected',
        'error'
      )),
    CONSTRAINT ingestion_records_row_number_check
      CHECK (row_number IS NULL OR row_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_records_source
ON ingestion_records(source_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_records_batch
ON ingestion_records(batch_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_records_status
ON ingestion_records(processing_status);

CREATE INDEX IF NOT EXISTS idx_ingestion_records_fingerprint
ON ingestion_records(fingerprint);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_spreadsheet_row
ON ingestion_records(batch_id, sheet_name, row_number)
WHERE batch_id IS NOT NULL AND sheet_name IS NOT NULL AND row_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ingestion_external_record
ON ingestion_records(source_id, external_record_id)
WHERE external_record_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS ingestion_entity_links (
    id                   bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ingestion_record_id  bigint NOT NULL REFERENCES ingestion_records(id) ON DELETE CASCADE,
    entity_type          varchar(50) NOT NULL,
    entity_id            uuid NOT NULL,
    link_type            varchar(20) NOT NULL,
    match_method         varchar(80) NULL,
    confidence           numeric(5,2) NULL,
    review_status        varchar(20) NOT NULL DEFAULT 'pending',
    reviewed_at          timestamptz NULL,
    review_notes         text NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT ingestion_entity_links_entity_type_check
      CHECK (entity_type IN (
        'jurisdiction',
        'node',
        'person',
        'person_contact',
        'node_participation',
        'node_participation_role',
        'person_consent'
      )),
    CONSTRAINT ingestion_entity_links_link_type_check
      CHECK (link_type IN ('created','matched','candidate','updated')),
    CONSTRAINT ingestion_entity_links_confidence_check
      CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 100),
    CONSTRAINT ingestion_entity_links_review_status_check
      CHECK (review_status IN ('pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_ingestion_entity_links_record
ON ingestion_entity_links(ingestion_record_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_entity_links_entity
ON ingestion_entity_links(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_ingestion_entity_links_review
ON ingestion_entity_links(review_status);

-- Consentimientos se crea después de ingestion_records para poder guardar
-- la evidencia exacta del formulario/fila que originó el consentimiento.
CREATE TABLE IF NOT EXISTS person_consents (
    id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id                     uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
    consent_type                  varchar(50) NOT NULL REFERENCES consent_types(code) ON DELETE RESTRICT,
    status                        varchar(20) NOT NULL,
    policy_version                varchar(30) NULL,
    granted_at                    timestamptz NULL,
    withdrawn_at                  timestamptz NULL,
    evidence_ingestion_record_id  bigint NULL REFERENCES ingestion_records(id) ON DELETE RESTRICT,
    notes                         text NULL,
    created_at                    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT person_consents_status_check
      CHECK (status IN ('granted','withdrawn','pending')),
    CONSTRAINT person_consents_dates_check
      CHECK (withdrawn_at IS NULL OR granted_at IS NULL OR withdrawn_at >= granted_at)
);

CREATE INDEX IF NOT EXISTS idx_person_consents_person
ON person_consents(person_id);

CREATE INDEX IF NOT EXISTS idx_person_consents_type_status
ON person_consents(consent_type, status);


-- Verifica que, cuando un registro pertenece a un lote, ambos apunten a la misma fuente.
CREATE OR REPLACE FUNCTION mp25m.check_ingestion_record_batch_source()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  batch_source uuid;
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    SELECT source_id INTO batch_source
    FROM mp25m.ingestion_batches
    WHERE id = NEW.batch_id;

    IF batch_source IS NULL THEN
      RAISE EXCEPTION 'Lote de ingesta inexistente: %', NEW.batch_id;
    END IF;

    IF batch_source <> NEW.source_id THEN
      RAISE EXCEPTION 'La fuente del registro (%) no coincide con la fuente del lote (%)',
        NEW.source_id, batch_source;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ingestion_record_batch_source ON ingestion_records;
CREATE TRIGGER trg_ingestion_record_batch_source
BEFORE INSERT OR UPDATE OF source_id, batch_id ON ingestion_records
FOR EACH ROW EXECUTE FUNCTION mp25m.check_ingestion_record_batch_source();

-- ---------------------------------------------------------------------------
-- 7. TRIGGERS updated_at
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_jurisdictions_updated_at ON jurisdictions;
CREATE TRIGGER trg_jurisdictions_updated_at
BEFORE UPDATE ON jurisdictions
FOR EACH ROW EXECUTE FUNCTION mp25m.set_updated_at();

DROP TRIGGER IF EXISTS trg_nodes_updated_at ON nodes;
CREATE TRIGGER trg_nodes_updated_at
BEFORE UPDATE ON nodes
FOR EACH ROW EXECUTE FUNCTION mp25m.set_updated_at();

DROP TRIGGER IF EXISTS trg_persons_updated_at ON persons;
CREATE TRIGGER trg_persons_updated_at
BEFORE UPDATE ON persons
FOR EACH ROW EXECUTE FUNCTION mp25m.set_updated_at();

DROP TRIGGER IF EXISTS trg_person_contacts_updated_at ON person_contacts;
CREATE TRIGGER trg_person_contacts_updated_at
BEFORE UPDATE ON person_contacts
FOR EACH ROW EXECUTE FUNCTION mp25m.set_updated_at();

DROP TRIGGER IF EXISTS trg_node_participations_updated_at ON node_participations;
CREATE TRIGGER trg_node_participations_updated_at
BEFORE UPDATE ON node_participations
FOR EACH ROW EXECUTE FUNCTION mp25m.set_updated_at();

DROP TRIGGER IF EXISTS trg_data_sources_updated_at ON data_sources;
CREATE TRIGGER trg_data_sources_updated_at
BEFORE UPDATE ON data_sources
FOR EACH ROW EXECUTE FUNCTION mp25m.set_updated_at();

-- ---------------------------------------------------------------------------
-- 8. CATÁLOGOS INICIALES
-- ---------------------------------------------------------------------------

INSERT INTO jurisdiction_types(code, name) VALUES
('country', 'País'),
('province', 'Provincia'),
('autonomous_city', 'Ciudad Autónoma'),
('department', 'Departamento'),
('municipality', 'Municipio'),
('partido', 'Partido'),
('commune', 'Comuna'),
('city', 'Ciudad'),
('neighborhood', 'Barrio'),
('zone', 'Zona')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name;

INSERT INTO roles(code, name, description, is_internal) VALUES
('founder', 'Fundador', 'Persona que comenzó la actividad del MP25M en la zona.', true),
('referent', 'Referente', 'Persona que atiende las articulaciones del MP25M en la zona.', true),
('participant', 'Participante', 'Persona que difunde y participa de la actividad del MP25M en la zona.', true),
('contact', 'Contacto', 'Contacto vinculado con fuerzas productivas u otras entidades; no implica pertenencia interna al MP25M.', false)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    is_internal = EXCLUDED.is_internal;

INSERT INTO consent_types(code, name, description) VALUES
('data_processing', 'Tratamiento de datos', 'Consentimiento para recopilar, almacenar y utilizar datos personales.'),
('communications', 'Comunicaciones', 'Consentimiento para recibir comunicaciones del MP25M.'),
('internal_directory', 'Directorio interno', 'Autorización para mostrar determinados datos dentro del sistema a miembros habilitados.'),
('public_profile', 'Perfil público', 'Autorización para publicar determinados datos en vistas públicas.')
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    description = EXCLUDED.description;

-- ---------------------------------------------------------------------------
-- 9. JURISDICCIONES BASE Y 53 NODOS ACTUALES
-- ---------------------------------------------------------------------------
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, 'country', 'Argentina', 'argentina', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, 'province', 'Buenos Aires', 'buenos aires',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, NULL, NULL)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('14583e77-0875-5d74-b172-6e1c00987ff3'::uuid, 'province', 'Córdoba', 'cordoba',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, NULL, NULL)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('dd7d3eee-16af-51ed-9c84-39a65b240733'::uuid, 'province', 'Chubut', 'chubut',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, -43.3, -65.1)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, 'autonomous_city', 'Ciudad Autónoma de Buenos Aires', 'ciudad autonoma de buenos aires',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, NULL, NULL)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('17c637b4-17e9-5108-a02a-21bb6d20b7f8'::uuid, 'province', 'Formosa', 'formosa',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, -24.895, -60.17)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('0c0aa7c8-25e3-5866-b075-496aa1bbaa25'::uuid, 'province', 'Mendoza', 'mendoza',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, NULL, NULL)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('e98df892-9353-5e88-80a7-15727e1fe0ed'::uuid, 'province', 'Misiones', 'misiones',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, -27.367, -55.896)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('fb6c3eeb-23dd-57f8-87b7-60d6184605f3'::uuid, 'province', 'Río Negro', 'rio negro',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, -40.8, -66)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('ea894c2f-2992-5ba5-b330-ae965caef755'::uuid, 'province', 'Santa Fe', 'santa fe',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, NULL, NULL)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('1cf350f1-ee70-508c-a82b-6921b34a3101'::uuid, 'province', 'Salta', 'salta',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, -24.3, -64.8)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('bd842458-a293-5743-98cf-1292fcb79039'::uuid, 'province', 'San Juan', 'san juan',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, -30.865, -68.889)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('3ae324cb-ad5b-595c-955f-9d54d26c8f3e'::uuid, 'province', 'San Luis', 'san luis',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, -33.765, -66.297)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('cfc371d4-3627-547e-a017-418a5eb97b81'::uuid, 'province', 'Tierra del Fuego, Antártida e Islas del Atlántico Sur', 'tierra del fuego antartida e islas del atlantico sur',
 '00a1461d-2c21-58ae-b4b2-ba985847087f'::uuid, -54.4, -67.7)
ON CONFLICT (id) DO UPDATE
SET latitude = COALESCE(EXCLUDED.latitude, jurisdictions.latitude),
    longitude = COALESCE(EXCLUDED.longitude, jurisdictions.longitude),
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('b8cb65c1-349a-5fcc-b4f7-2a85d967fa29'::uuid, 'partido', 'Tres de Febrero', 'tres de febrero',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.603, -58.563)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('46e45b69-7f60-5626-a608-efa00dede3d9'::uuid, 'partido', 'Avellaneda', 'avellaneda',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.661, -58.366)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('e98b20da-d94d-51b5-84ea-1d84c5c87294'::uuid, 'partido', 'Berazategui', 'berazategui',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.765, -58.212)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('906da1df-fca7-5b5b-94d6-439ed9cc3e1b'::uuid, 'partido', 'Brandsen', 'brandsen',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -35.169, -58.225)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('d75abb7e-4ce1-5754-b6bb-2bf27fd839d1'::uuid, 'department', 'Calamuchita', 'calamuchita',
 '14583e77-0875-5d74-b172-6e1c00987ff3'::uuid, -32.2, -64.55)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('8d0a5bd1-62af-5343-9a53-bfa917188d9d'::uuid, 'municipality', 'Capilla del Monte', 'capilla del monte',
 '14583e77-0875-5d74-b172-6e1c00987ff3'::uuid, -30.86, -64.525)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('f0ea0eb5-2322-5f8a-bfd7-cfff7bff2bdd'::uuid, 'commune', 'Comuna 1', 'comuna 1',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.608, -58.371)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('d9e1b328-eb37-546c-8ab4-1943ede1b6c1'::uuid, 'commune', 'Comuna 10', 'comuna 10',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.633, -58.5)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('0e6fce7b-954c-5065-819d-7fc116cddac0'::uuid, 'commune', 'Comuna 11', 'comuna 11',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.603, -58.498)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('a9965b2e-5985-5b85-ade3-293caa5829b4'::uuid, 'commune', 'Comuna 12', 'comuna 12',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.569, -58.488)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('59e8f130-14fa-5e06-b403-f870c0965c94'::uuid, 'commune', 'Comuna 13', 'comuna 13',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.555, -58.456)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('8cad3704-cd1f-5960-a1ea-49e37da3dab7'::uuid, 'commune', 'Comuna 14', 'comuna 14',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.576, -58.42)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('0ef2bff9-1731-533e-929c-b318d03e799a'::uuid, 'commune', 'Comuna 15', 'comuna 15',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.592, -58.462)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('ba0ebf4a-d6b0-5400-856e-e3fc4e920d87'::uuid, 'commune', 'Comuna 2', 'comuna 2',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.587, -58.397)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('4f00f41d-56dc-5d05-b139-745ca527d3f3'::uuid, 'commune', 'Comuna 3', 'comuna 3',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.61, -58.402)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('0033eeaa-dee5-56da-bba6-89e1cc31f350'::uuid, 'commune', 'Comuna 4', 'comuna 4',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.645, -58.383)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('31f68320-50e5-5cbc-be71-28b1c3bc73fc'::uuid, 'commune', 'Comuna 5', 'comuna 5',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.618, -58.42)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('884f7c34-2833-5bf6-bb4a-71b9909edf6c'::uuid, 'commune', 'Comuna 6', 'comuna 6',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.622, -58.444)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('1f072f8d-5b66-5fc5-84b0-3fbca1b411af'::uuid, 'commune', 'Comuna 7', 'comuna 7',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.638, -58.462)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('d35ca165-5091-5cc1-ad7c-233ba338fee2'::uuid, 'commune', 'Comuna 8', 'comuna 8',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.675, -58.461)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('247566a2-1ebf-5717-bdbe-02119a4d69e0'::uuid, 'commune', 'Comuna 9', 'comuna 9',
 '5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, -34.65, -58.5)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('d5750ee8-5ae3-5257-a08b-ce003f5cf9fc'::uuid, 'partido', 'Ezeiza', 'ezeiza',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.853, -58.524)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('d5f8b268-6cc7-5215-93f8-cf5191761820'::uuid, 'partido', 'Florencio Varela', 'florencio varela',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.799, -58.277)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('2c11173b-0f54-526b-9d3f-35165aa780d1'::uuid, 'partido', 'Junín', 'junin',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.589, -60.949)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('a6fa2179-962b-5344-95f0-8fecac224122'::uuid, 'partido', 'La Matanza', 'la matanza',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.771, -58.625)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('abe78166-4df3-5fcf-8166-7452acbe13ee'::uuid, 'partido', 'La Plata', 'la plata',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.921, -57.955)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('4eff341c-69f7-5811-bb83-f1d4b08229bd'::uuid, 'partido', 'Lanús', 'lanus',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.702, -58.392)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('4a403c78-5cee-5ea8-b7f7-6009b7a836d9'::uuid, 'partido', 'Lezama', 'lezama',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -35.876, -57.898)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('26059f4b-09c9-5481-987c-17bf910ac290'::uuid, 'partido', 'Luján', 'lujan',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.57, -59.105)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('8ec752af-da5c-567e-a0ec-d3e229164a65'::uuid, 'department', 'Maipú', 'maipu',
 '0c0aa7c8-25e3-5866-b075-496aa1bbaa25'::uuid, -32.977, -68.783)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('93ef0b5b-9c9d-58a9-9e9d-787b3a3ce8ea'::uuid, 'partido', 'Malvinas Argentinas', 'malvinas argentinas',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.521, -58.705)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('412029fa-7c74-52ab-ba1e-cce6965c803d'::uuid, 'partido', 'General Pueyrredón (Mar del Plata)', 'general pueyrredon mar del plata',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -38.006, -57.542)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('9a88284b-2615-5390-9770-d06faec12ad2'::uuid, 'partido', 'Merlo', 'merlo',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.666, -58.729)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('92334ac3-01f4-5b57-9694-d215584c2298'::uuid, 'partido', 'Moreno', 'moreno',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.634, -58.791)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('def3599c-7115-5685-a26c-81deb17ea566'::uuid, 'partido', 'Morón', 'moron',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.653, -58.619)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('5aa76c8e-c519-5391-ab40-c199dca608d9'::uuid, 'partido', 'Pilar', 'pilar',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.458, -58.914)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('edcaa4c6-14ff-5790-9d61-31870f48f6be'::uuid, 'partido', 'Presidente Perón', 'presidente peron',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.914, -58.381)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('0b5272be-ff3f-5339-90dc-ae0e68548318'::uuid, 'partido', 'Quilmes', 'quilmes',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.724, -58.254)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('2ac76751-226e-523f-b458-0d1b41aa918b'::uuid, 'municipality', 'Rosario', 'rosario',
 'ea894c2f-2992-5ba5-b330-ae965caef755'::uuid, -32.944, -60.65)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('2f52bf20-51cf-5b49-a585-b1d7e723c160'::uuid, 'partido', 'San Isidro', 'san isidro',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.472, -58.527)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('6812dbf4-d5c9-546c-9401-390e72ce6fb1'::uuid, 'partido', 'General San Martín', 'general san martin',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.574, -58.536)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('1a2cafe8-5b4d-5f21-8c30-f2454be2aee7'::uuid, 'partido', 'San Miguel', 'san miguel',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.543, -58.712)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('b062ed98-0cc6-5f04-9674-40a8945d9909'::uuid, 'partido', 'San Vicente', 'san vicente',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -35.025, -58.423)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('875659de-6368-5b72-88d0-c7e0b516ecf5'::uuid, 'partido', 'Tandil', 'tandil',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -37.321, -59.133)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO jurisdictions
(id, type_code, name, normalized_name, parent_id, latitude, longitude)
VALUES
('f25a6834-8a61-5fbb-82ea-e23deb152a47'::uuid, 'partido', 'Vicente López', 'vicente lopez',
 '9d12e501-4a71-54e8-9c86-4534dcea8193'::uuid, -34.529, -58.473)
ON CONFLICT (id) DO UPDATE
SET latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('b2129e9e-f401-5aff-8b1e-965c487c3ae3'::uuid, 1, 'Nodo 3 de Febrero', 'nodo 3 de febrero', '3-de-febrero', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('b2129e9e-f401-5aff-8b1e-965c487c3ae3'::uuid, 'b8cb65c1-349a-5fcc-b4f7-2a85d967fa29'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b2129e9e-f401-5aff-8b1e-965c487c3ae3'::uuid, '3 de Febrero', '3 de febrero')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b2129e9e-f401-5aff-8b1e-965c487c3ae3'::uuid, 'Tres de Febrero', 'tres de febrero')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b2129e9e-f401-5aff-8b1e-965c487c3ae3'::uuid, 'Nodo 3 de Febrero', 'nodo 3 de febrero')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('395be3ce-971d-551c-8657-5d1f6fe3253d'::uuid, 2, 'Nodo Avellaneda', 'nodo avellaneda', 'avellaneda', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('395be3ce-971d-551c-8657-5d1f6fe3253d'::uuid, '46e45b69-7f60-5626-a608-efa00dede3d9'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('395be3ce-971d-551c-8657-5d1f6fe3253d'::uuid, 'Avellaneda', 'avellaneda')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('395be3ce-971d-551c-8657-5d1f6fe3253d'::uuid, 'Nodo Avellaneda', 'nodo avellaneda')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('22ac91be-ff03-55f3-be10-3f72fab55e78'::uuid, 3, 'Nodo Berazategui', 'nodo berazategui', 'berazategui', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('22ac91be-ff03-55f3-be10-3f72fab55e78'::uuid, 'e98b20da-d94d-51b5-84ea-1d84c5c87294'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('22ac91be-ff03-55f3-be10-3f72fab55e78'::uuid, 'Berazategui', 'berazategui')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('22ac91be-ff03-55f3-be10-3f72fab55e78'::uuid, 'Nodo Berazategui', 'nodo berazategui')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('4f673811-bddb-52a7-ae71-856bc47a7726'::uuid, 4, 'Nodo Brandsen', 'nodo brandsen', 'brandsen', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('4f673811-bddb-52a7-ae71-856bc47a7726'::uuid, '906da1df-fca7-5b5b-94d6-439ed9cc3e1b'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('4f673811-bddb-52a7-ae71-856bc47a7726'::uuid, 'Brandsen', 'brandsen')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('4f673811-bddb-52a7-ae71-856bc47a7726'::uuid, 'Nodo Brandsen', 'nodo brandsen')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('77ee24e6-e286-525e-9dec-357755d06139'::uuid, 5, 'Nodo Calamuchita – Cordoba', 'nodo calamuchita cordoba', 'calamuchita-cordoba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('77ee24e6-e286-525e-9dec-357755d06139'::uuid, 'd75abb7e-4ce1-5754-b6bb-2bf27fd839d1'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('77ee24e6-e286-525e-9dec-357755d06139'::uuid, 'Calamuchita – Cordoba', 'calamuchita cordoba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('77ee24e6-e286-525e-9dec-357755d06139'::uuid, 'Calamuchita', 'calamuchita')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('77ee24e6-e286-525e-9dec-357755d06139'::uuid, 'Nodo Calamuchita – Cordoba', 'nodo calamuchita cordoba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('86a6f058-5a36-5708-954e-bd2e3842305f'::uuid, 6, 'Nodo Capilla del Monte – Cordoba', 'nodo capilla del monte cordoba', 'capilla-del-monte-cordoba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('86a6f058-5a36-5708-954e-bd2e3842305f'::uuid, '8d0a5bd1-62af-5343-9a53-bfa917188d9d'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('86a6f058-5a36-5708-954e-bd2e3842305f'::uuid, 'Capilla del Monte – Cordoba', 'capilla del monte cordoba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('86a6f058-5a36-5708-954e-bd2e3842305f'::uuid, 'Capilla del Monte', 'capilla del monte')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('86a6f058-5a36-5708-954e-bd2e3842305f'::uuid, 'Nodo Capilla del Monte – Cordoba', 'nodo capilla del monte cordoba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('96c9fe8c-4294-5cf6-b580-3eadc624d5f8'::uuid, 7, 'Nodo Chubut', 'nodo chubut', 'chubut', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('96c9fe8c-4294-5cf6-b580-3eadc624d5f8'::uuid, 'dd7d3eee-16af-51ed-9c84-39a65b240733'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('96c9fe8c-4294-5cf6-b580-3eadc624d5f8'::uuid, 'Chubut', 'chubut')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('96c9fe8c-4294-5cf6-b580-3eadc624d5f8'::uuid, 'Nodo Chubut', 'nodo chubut')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('b8b358c2-a0a1-5c73-8696-32e5d92e6ea4'::uuid, 8, 'Nodo Comuna 1 CABA', 'nodo comuna 1 caba', 'comuna-1-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('b8b358c2-a0a1-5c73-8696-32e5d92e6ea4'::uuid, 'f0ea0eb5-2322-5f8a-bfd7-cfff7bff2bdd'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b8b358c2-a0a1-5c73-8696-32e5d92e6ea4'::uuid, 'Comuna 1 CABA', 'comuna 1 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b8b358c2-a0a1-5c73-8696-32e5d92e6ea4'::uuid, 'Comuna 1', 'comuna 1')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b8b358c2-a0a1-5c73-8696-32e5d92e6ea4'::uuid, 'Nodo Comuna 1 CABA', 'nodo comuna 1 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('45aa3c48-06f2-5940-9171-1931aacf7405'::uuid, 9, 'Nodo Comuna 10 CABA', 'nodo comuna 10 caba', 'comuna-10-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('45aa3c48-06f2-5940-9171-1931aacf7405'::uuid, 'd9e1b328-eb37-546c-8ab4-1943ede1b6c1'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('45aa3c48-06f2-5940-9171-1931aacf7405'::uuid, 'Comuna 10 CABA', 'comuna 10 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('45aa3c48-06f2-5940-9171-1931aacf7405'::uuid, 'Comuna 10', 'comuna 10')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('45aa3c48-06f2-5940-9171-1931aacf7405'::uuid, 'Nodo Comuna 10 CABA', 'nodo comuna 10 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('cf7e3e23-593e-5386-bb6f-f1a73c31ae2a'::uuid, 10, 'Nodo Comuna 11 CABA', 'nodo comuna 11 caba', 'comuna-11-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('cf7e3e23-593e-5386-bb6f-f1a73c31ae2a'::uuid, '0e6fce7b-954c-5065-819d-7fc116cddac0'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cf7e3e23-593e-5386-bb6f-f1a73c31ae2a'::uuid, 'Comuna 11 CABA', 'comuna 11 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cf7e3e23-593e-5386-bb6f-f1a73c31ae2a'::uuid, 'Comuna 11', 'comuna 11')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cf7e3e23-593e-5386-bb6f-f1a73c31ae2a'::uuid, 'Nodo Comuna 11 CABA', 'nodo comuna 11 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('433a9684-4810-5f20-9764-8a61a5cd37bf'::uuid, 11, 'Nodo Comuna 12 CABA', 'nodo comuna 12 caba', 'comuna-12-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('433a9684-4810-5f20-9764-8a61a5cd37bf'::uuid, 'a9965b2e-5985-5b85-ade3-293caa5829b4'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('433a9684-4810-5f20-9764-8a61a5cd37bf'::uuid, 'Comuna 12 CABA', 'comuna 12 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('433a9684-4810-5f20-9764-8a61a5cd37bf'::uuid, 'Comuna 12', 'comuna 12')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('433a9684-4810-5f20-9764-8a61a5cd37bf'::uuid, 'Nodo Comuna 12 CABA', 'nodo comuna 12 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('03112c77-562a-5dac-b83c-17db4fb36f77'::uuid, 12, 'Nodo Comuna 13 CABA', 'nodo comuna 13 caba', 'comuna-13-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('03112c77-562a-5dac-b83c-17db4fb36f77'::uuid, '59e8f130-14fa-5e06-b403-f870c0965c94'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('03112c77-562a-5dac-b83c-17db4fb36f77'::uuid, 'Comuna 13 CABA', 'comuna 13 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('03112c77-562a-5dac-b83c-17db4fb36f77'::uuid, 'Comuna 13', 'comuna 13')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('03112c77-562a-5dac-b83c-17db4fb36f77'::uuid, 'Nodo Comuna 13 CABA', 'nodo comuna 13 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('ace27653-573e-5782-bd49-a094912306f9'::uuid, 13, 'Nodo Comuna 14 CABA', 'nodo comuna 14 caba', 'comuna-14-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('ace27653-573e-5782-bd49-a094912306f9'::uuid, '8cad3704-cd1f-5960-a1ea-49e37da3dab7'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('ace27653-573e-5782-bd49-a094912306f9'::uuid, 'Comuna 14 CABA', 'comuna 14 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('ace27653-573e-5782-bd49-a094912306f9'::uuid, 'Comuna 14', 'comuna 14')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('ace27653-573e-5782-bd49-a094912306f9'::uuid, 'Nodo Comuna 14 CABA', 'nodo comuna 14 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('0da15fa5-10fb-5976-ba38-ed48924c536f'::uuid, 14, 'Nodo Comuna 15 CABA', 'nodo comuna 15 caba', 'comuna-15-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('0da15fa5-10fb-5976-ba38-ed48924c536f'::uuid, '0ef2bff9-1731-533e-929c-b318d03e799a'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('0da15fa5-10fb-5976-ba38-ed48924c536f'::uuid, 'Comuna 15 CABA', 'comuna 15 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('0da15fa5-10fb-5976-ba38-ed48924c536f'::uuid, 'Comuna 15', 'comuna 15')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('0da15fa5-10fb-5976-ba38-ed48924c536f'::uuid, 'Nodo Comuna 15 CABA', 'nodo comuna 15 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('e2cb6026-224c-5657-bdf8-b187f14999ae'::uuid, 15, 'Nodo Comuna 2 CABA', 'nodo comuna 2 caba', 'comuna-2-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('e2cb6026-224c-5657-bdf8-b187f14999ae'::uuid, 'ba0ebf4a-d6b0-5400-856e-e3fc4e920d87'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('e2cb6026-224c-5657-bdf8-b187f14999ae'::uuid, 'Comuna 2 CABA', 'comuna 2 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('e2cb6026-224c-5657-bdf8-b187f14999ae'::uuid, 'Comuna 2', 'comuna 2')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('e2cb6026-224c-5657-bdf8-b187f14999ae'::uuid, 'Nodo Comuna 2 CABA', 'nodo comuna 2 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('b5124ded-617a-59f6-abd2-21e8b70252a8'::uuid, 16, 'Nodo Comuna 3 CABA', 'nodo comuna 3 caba', 'comuna-3-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('b5124ded-617a-59f6-abd2-21e8b70252a8'::uuid, '4f00f41d-56dc-5d05-b139-745ca527d3f3'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b5124ded-617a-59f6-abd2-21e8b70252a8'::uuid, 'Comuna 3 CABA', 'comuna 3 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b5124ded-617a-59f6-abd2-21e8b70252a8'::uuid, 'Comuna 3', 'comuna 3')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b5124ded-617a-59f6-abd2-21e8b70252a8'::uuid, 'Nodo Comuna 3 CABA', 'nodo comuna 3 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('c6bb0cbe-aa30-5964-a100-3b0a207871bf'::uuid, 17, 'Nodo Comuna 4 CABA', 'nodo comuna 4 caba', 'comuna-4-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('c6bb0cbe-aa30-5964-a100-3b0a207871bf'::uuid, '0033eeaa-dee5-56da-bba6-89e1cc31f350'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c6bb0cbe-aa30-5964-a100-3b0a207871bf'::uuid, 'Comuna 4 CABA', 'comuna 4 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c6bb0cbe-aa30-5964-a100-3b0a207871bf'::uuid, 'Comuna 4', 'comuna 4')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c6bb0cbe-aa30-5964-a100-3b0a207871bf'::uuid, 'Nodo Comuna 4 CABA', 'nodo comuna 4 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('c64dd1ac-d8b4-54a5-b073-304794bef090'::uuid, 18, 'Nodo Comuna 5 CABA', 'nodo comuna 5 caba', 'comuna-5-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('c64dd1ac-d8b4-54a5-b073-304794bef090'::uuid, '31f68320-50e5-5cbc-be71-28b1c3bc73fc'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c64dd1ac-d8b4-54a5-b073-304794bef090'::uuid, 'Comuna 5 CABA', 'comuna 5 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c64dd1ac-d8b4-54a5-b073-304794bef090'::uuid, 'Comuna 5', 'comuna 5')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c64dd1ac-d8b4-54a5-b073-304794bef090'::uuid, 'Nodo Comuna 5 CABA', 'nodo comuna 5 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('cbf34df5-6a78-5ab7-a419-6c0abcd472b8'::uuid, 19, 'Nodo Comuna 6 CABA', 'nodo comuna 6 caba', 'comuna-6-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('cbf34df5-6a78-5ab7-a419-6c0abcd472b8'::uuid, '884f7c34-2833-5bf6-bb4a-71b9909edf6c'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cbf34df5-6a78-5ab7-a419-6c0abcd472b8'::uuid, 'Comuna 6 CABA', 'comuna 6 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cbf34df5-6a78-5ab7-a419-6c0abcd472b8'::uuid, 'Comuna 6', 'comuna 6')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cbf34df5-6a78-5ab7-a419-6c0abcd472b8'::uuid, 'Nodo Comuna 6 CABA', 'nodo comuna 6 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('0b260c0c-dda3-5cab-aad9-833b1215d5d1'::uuid, 20, 'Nodo Comuna 7 CABA', 'nodo comuna 7 caba', 'comuna-7-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('0b260c0c-dda3-5cab-aad9-833b1215d5d1'::uuid, '1f072f8d-5b66-5fc5-84b0-3fbca1b411af'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('0b260c0c-dda3-5cab-aad9-833b1215d5d1'::uuid, 'Comuna 7 CABA', 'comuna 7 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('0b260c0c-dda3-5cab-aad9-833b1215d5d1'::uuid, 'Comuna 7', 'comuna 7')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('0b260c0c-dda3-5cab-aad9-833b1215d5d1'::uuid, 'Nodo Comuna 7 CABA', 'nodo comuna 7 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('caf1ec9e-37f8-5595-b0b2-862b3feeea12'::uuid, 21, 'Nodo Comuna 8 CABA', 'nodo comuna 8 caba', 'comuna-8-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('caf1ec9e-37f8-5595-b0b2-862b3feeea12'::uuid, 'd35ca165-5091-5cc1-ad7c-233ba338fee2'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('caf1ec9e-37f8-5595-b0b2-862b3feeea12'::uuid, 'Comuna 8 CABA', 'comuna 8 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('caf1ec9e-37f8-5595-b0b2-862b3feeea12'::uuid, 'Comuna 8', 'comuna 8')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('caf1ec9e-37f8-5595-b0b2-862b3feeea12'::uuid, 'Nodo Comuna 8 CABA', 'nodo comuna 8 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('4b844696-321d-523f-a3b6-10de2eea8a2e'::uuid, 22, 'Nodo Comuna 9 CABA', 'nodo comuna 9 caba', 'comuna-9-caba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('4b844696-321d-523f-a3b6-10de2eea8a2e'::uuid, '247566a2-1ebf-5717-bdbe-02119a4d69e0'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('4b844696-321d-523f-a3b6-10de2eea8a2e'::uuid, 'Comuna 9 CABA', 'comuna 9 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('4b844696-321d-523f-a3b6-10de2eea8a2e'::uuid, 'Comuna 9', 'comuna 9')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('4b844696-321d-523f-a3b6-10de2eea8a2e'::uuid, 'Nodo Comuna 9 CABA', 'nodo comuna 9 caba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('7578ccc3-ef4f-53d6-b465-b1c875e17349'::uuid, 23, 'Nodo Ezeiza', 'nodo ezeiza', 'ezeiza', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('7578ccc3-ef4f-53d6-b465-b1c875e17349'::uuid, 'd5750ee8-5ae3-5257-a08b-ce003f5cf9fc'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('7578ccc3-ef4f-53d6-b465-b1c875e17349'::uuid, 'Ezeiza', 'ezeiza')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('7578ccc3-ef4f-53d6-b465-b1c875e17349'::uuid, 'Nodo Ezeiza', 'nodo ezeiza')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('1f100997-9520-5e74-8b6d-0a7e32546af9'::uuid, 24, 'Nodo Florencio Varela', 'nodo florencio varela', 'florencio-varela', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('1f100997-9520-5e74-8b6d-0a7e32546af9'::uuid, 'd5f8b268-6cc7-5215-93f8-cf5191761820'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('1f100997-9520-5e74-8b6d-0a7e32546af9'::uuid, 'Florencio Varela', 'florencio varela')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('1f100997-9520-5e74-8b6d-0a7e32546af9'::uuid, 'Nodo Florencio Varela', 'nodo florencio varela')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('28b7a927-9d04-550e-a143-4cd9d2f7c4ff'::uuid, 25, 'Nodo Formosa', 'nodo formosa', 'formosa', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('28b7a927-9d04-550e-a143-4cd9d2f7c4ff'::uuid, '17c637b4-17e9-5108-a02a-21bb6d20b7f8'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('28b7a927-9d04-550e-a143-4cd9d2f7c4ff'::uuid, 'Formosa', 'formosa')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('28b7a927-9d04-550e-a143-4cd9d2f7c4ff'::uuid, 'Nodo Formosa', 'nodo formosa')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('079bd763-a17c-5352-b3cb-007005ee2d42'::uuid, 26, 'Nodo Junin', 'nodo junin', 'junin', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('079bd763-a17c-5352-b3cb-007005ee2d42'::uuid, '2c11173b-0f54-526b-9d3f-35165aa780d1'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('079bd763-a17c-5352-b3cb-007005ee2d42'::uuid, 'Junin', 'junin')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('079bd763-a17c-5352-b3cb-007005ee2d42'::uuid, 'Junín', 'junin')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('079bd763-a17c-5352-b3cb-007005ee2d42'::uuid, 'Nodo Junin', 'nodo junin')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('ebdf7a4b-e7c9-56bc-b4ff-66a75da76554'::uuid, 27, 'Nodo La Matanza', 'nodo la matanza', 'la-matanza', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('ebdf7a4b-e7c9-56bc-b4ff-66a75da76554'::uuid, 'a6fa2179-962b-5344-95f0-8fecac224122'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('ebdf7a4b-e7c9-56bc-b4ff-66a75da76554'::uuid, 'La Matanza', 'la matanza')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('ebdf7a4b-e7c9-56bc-b4ff-66a75da76554'::uuid, 'Nodo La Matanza', 'nodo la matanza')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('70f52ada-80de-5d05-9dd2-97ac95408193'::uuid, 28, 'Nodo La Plata', 'nodo la plata', 'la-plata', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('70f52ada-80de-5d05-9dd2-97ac95408193'::uuid, 'abe78166-4df3-5fcf-8166-7452acbe13ee'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('70f52ada-80de-5d05-9dd2-97ac95408193'::uuid, 'La Plata', 'la plata')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('70f52ada-80de-5d05-9dd2-97ac95408193'::uuid, 'Nodo La Plata', 'nodo la plata')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('2d624fda-b8c9-5038-bb4e-c3098067c876'::uuid, 29, 'Nodo Lanus', 'nodo lanus', 'lanus', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('2d624fda-b8c9-5038-bb4e-c3098067c876'::uuid, '4eff341c-69f7-5811-bb83-f1d4b08229bd'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('2d624fda-b8c9-5038-bb4e-c3098067c876'::uuid, 'Lanus', 'lanus')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('2d624fda-b8c9-5038-bb4e-c3098067c876'::uuid, 'Lanús', 'lanus')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('2d624fda-b8c9-5038-bb4e-c3098067c876'::uuid, 'Nodo Lanus', 'nodo lanus')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('ffa7ac49-0e8a-5a69-903a-c728b7a9cf3b'::uuid, 30, 'Nodo Lezama', 'nodo lezama', 'lezama', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('ffa7ac49-0e8a-5a69-903a-c728b7a9cf3b'::uuid, '4a403c78-5cee-5ea8-b7f7-6009b7a836d9'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('ffa7ac49-0e8a-5a69-903a-c728b7a9cf3b'::uuid, 'Lezama', 'lezama')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('ffa7ac49-0e8a-5a69-903a-c728b7a9cf3b'::uuid, 'Nodo Lezama', 'nodo lezama')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('cee0ed53-ae93-51ea-886a-4037101db491'::uuid, 31, 'Nodo Lujan', 'nodo lujan', 'lujan', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('cee0ed53-ae93-51ea-886a-4037101db491'::uuid, '26059f4b-09c9-5481-987c-17bf910ac290'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cee0ed53-ae93-51ea-886a-4037101db491'::uuid, 'Lujan', 'lujan')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cee0ed53-ae93-51ea-886a-4037101db491'::uuid, 'Luján', 'lujan')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('cee0ed53-ae93-51ea-886a-4037101db491'::uuid, 'Nodo Lujan', 'nodo lujan')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('a69a0816-1e95-51a1-9f2f-e330db27935e'::uuid, 32, 'Nodo Maipú – Mendoza', 'nodo maipu mendoza', 'maipu-mendoza', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('a69a0816-1e95-51a1-9f2f-e330db27935e'::uuid, '8ec752af-da5c-567e-a0ec-d3e229164a65'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('a69a0816-1e95-51a1-9f2f-e330db27935e'::uuid, 'Maipú – Mendoza', 'maipu mendoza')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('a69a0816-1e95-51a1-9f2f-e330db27935e'::uuid, 'Maipú', 'maipu')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('a69a0816-1e95-51a1-9f2f-e330db27935e'::uuid, 'Nodo Maipú – Mendoza', 'nodo maipu mendoza')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('2cae5950-6522-5721-a443-1d6c7c922591'::uuid, 33, 'Nodo Malvinas Argentinas', 'nodo malvinas argentinas', 'malvinas-argentinas', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('2cae5950-6522-5721-a443-1d6c7c922591'::uuid, '93ef0b5b-9c9d-58a9-9e9d-787b3a3ce8ea'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('2cae5950-6522-5721-a443-1d6c7c922591'::uuid, 'Malvinas Argentinas', 'malvinas argentinas')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('2cae5950-6522-5721-a443-1d6c7c922591'::uuid, 'Nodo Malvinas Argentinas', 'nodo malvinas argentinas')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('3f06188a-f480-56d9-afdc-b4060d78b9fc'::uuid, 34, 'Nodo Mar del Plata', 'nodo mar del plata', 'mar-del-plata', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('3f06188a-f480-56d9-afdc-b4060d78b9fc'::uuid, '412029fa-7c74-52ab-ba1e-cce6965c803d'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('3f06188a-f480-56d9-afdc-b4060d78b9fc'::uuid, 'Mar del Plata', 'mar del plata')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('3f06188a-f480-56d9-afdc-b4060d78b9fc'::uuid, 'General Pueyrredón (Mar del Plata)', 'general pueyrredon mar del plata')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('3f06188a-f480-56d9-afdc-b4060d78b9fc'::uuid, 'Nodo Mar del Plata', 'nodo mar del plata')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('9830c447-d200-54c9-a3b0-25f5088576c2'::uuid, 35, 'Nodo Merlo', 'nodo merlo', 'merlo', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('9830c447-d200-54c9-a3b0-25f5088576c2'::uuid, '9a88284b-2615-5390-9770-d06faec12ad2'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('9830c447-d200-54c9-a3b0-25f5088576c2'::uuid, 'Merlo', 'merlo')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('9830c447-d200-54c9-a3b0-25f5088576c2'::uuid, 'Nodo Merlo', 'nodo merlo')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('2e0a8607-71c1-5b0a-91ae-8dbd67cfff9a'::uuid, 36, 'Nodo Misiones', 'nodo misiones', 'misiones', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('2e0a8607-71c1-5b0a-91ae-8dbd67cfff9a'::uuid, 'e98df892-9353-5e88-80a7-15727e1fe0ed'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('2e0a8607-71c1-5b0a-91ae-8dbd67cfff9a'::uuid, 'Misiones', 'misiones')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('2e0a8607-71c1-5b0a-91ae-8dbd67cfff9a'::uuid, 'Nodo Misiones', 'nodo misiones')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('60274fda-77f4-57ef-a057-f403a1cb7a4d'::uuid, 37, 'Nodo Moreno', 'nodo moreno', 'moreno', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('60274fda-77f4-57ef-a057-f403a1cb7a4d'::uuid, '92334ac3-01f4-5b57-9694-d215584c2298'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('60274fda-77f4-57ef-a057-f403a1cb7a4d'::uuid, 'Moreno', 'moreno')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('60274fda-77f4-57ef-a057-f403a1cb7a4d'::uuid, 'Nodo Moreno', 'nodo moreno')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('64c5e4f6-5907-587f-af8c-33495f914328'::uuid, 38, 'Nodo Morón', 'nodo moron', 'moron', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('64c5e4f6-5907-587f-af8c-33495f914328'::uuid, 'def3599c-7115-5685-a26c-81deb17ea566'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('64c5e4f6-5907-587f-af8c-33495f914328'::uuid, 'Morón', 'moron')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('64c5e4f6-5907-587f-af8c-33495f914328'::uuid, 'Nodo Morón', 'nodo moron')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('c24d0d99-fb6d-525b-abc9-84eeff01d54b'::uuid, 39, 'Nodo Pilar', 'nodo pilar', 'pilar', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('c24d0d99-fb6d-525b-abc9-84eeff01d54b'::uuid, '5aa76c8e-c519-5391-ab40-c199dca608d9'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c24d0d99-fb6d-525b-abc9-84eeff01d54b'::uuid, 'Pilar', 'pilar')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c24d0d99-fb6d-525b-abc9-84eeff01d54b'::uuid, 'Nodo Pilar', 'nodo pilar')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('92e54ba1-b97e-5af8-aa34-7337d6a49811'::uuid, 40, 'Nodo Presidente Peron', 'nodo presidente peron', 'presidente-peron', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('92e54ba1-b97e-5af8-aa34-7337d6a49811'::uuid, 'edcaa4c6-14ff-5790-9d61-31870f48f6be'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('92e54ba1-b97e-5af8-aa34-7337d6a49811'::uuid, 'Presidente Peron', 'presidente peron')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('92e54ba1-b97e-5af8-aa34-7337d6a49811'::uuid, 'Presidente Perón', 'presidente peron')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('92e54ba1-b97e-5af8-aa34-7337d6a49811'::uuid, 'Nodo Presidente Peron', 'nodo presidente peron')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('f549315d-9d3c-507c-afd0-4cec9a120cf6'::uuid, 41, 'Nodo Quilmes', 'nodo quilmes', 'quilmes', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('f549315d-9d3c-507c-afd0-4cec9a120cf6'::uuid, '0b5272be-ff3f-5339-90dc-ae0e68548318'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('f549315d-9d3c-507c-afd0-4cec9a120cf6'::uuid, 'Quilmes', 'quilmes')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('f549315d-9d3c-507c-afd0-4cec9a120cf6'::uuid, 'Nodo Quilmes', 'nodo quilmes')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('f17eaabf-94e9-5061-844f-e7e92de1fcd3'::uuid, 42, 'Nodo Rio Negro', 'nodo rio negro', 'rio-negro', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('f17eaabf-94e9-5061-844f-e7e92de1fcd3'::uuid, 'fb6c3eeb-23dd-57f8-87b7-60d6184605f3'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('f17eaabf-94e9-5061-844f-e7e92de1fcd3'::uuid, 'Rio Negro', 'rio negro')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('f17eaabf-94e9-5061-844f-e7e92de1fcd3'::uuid, 'Río Negro', 'rio negro')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('f17eaabf-94e9-5061-844f-e7e92de1fcd3'::uuid, 'Nodo Rio Negro', 'nodo rio negro')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('8835415e-b4b0-5e0f-8272-4ca5c3454687'::uuid, 43, 'Nodo Rosario – Santa Fé', 'nodo rosario santa fe', 'rosario-santa-fe', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('8835415e-b4b0-5e0f-8272-4ca5c3454687'::uuid, '2ac76751-226e-523f-b458-0d1b41aa918b'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('8835415e-b4b0-5e0f-8272-4ca5c3454687'::uuid, 'Rosario – Santa Fé', 'rosario santa fe')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('8835415e-b4b0-5e0f-8272-4ca5c3454687'::uuid, 'Rosario', 'rosario')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('8835415e-b4b0-5e0f-8272-4ca5c3454687'::uuid, 'Nodo Rosario – Santa Fé', 'nodo rosario santa fe')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('d49f58b2-bc36-51b6-8534-c9ec1abca264'::uuid, 44, 'Nodo Salta', 'nodo salta', 'salta', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('d49f58b2-bc36-51b6-8534-c9ec1abca264'::uuid, '1cf350f1-ee70-508c-a82b-6921b34a3101'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('d49f58b2-bc36-51b6-8534-c9ec1abca264'::uuid, 'Salta', 'salta')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('d49f58b2-bc36-51b6-8534-c9ec1abca264'::uuid, 'Nodo Salta', 'nodo salta')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('b0ba0556-7926-552d-8f1d-1046ce83aa46'::uuid, 45, 'Nodo San Isidro', 'nodo san isidro', 'san-isidro', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('b0ba0556-7926-552d-8f1d-1046ce83aa46'::uuid, '2f52bf20-51cf-5b49-a585-b1d7e723c160'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b0ba0556-7926-552d-8f1d-1046ce83aa46'::uuid, 'San Isidro', 'san isidro')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('b0ba0556-7926-552d-8f1d-1046ce83aa46'::uuid, 'Nodo San Isidro', 'nodo san isidro')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('be363dca-11b8-5407-91d6-0bf4b5d8aab0'::uuid, 46, 'Nodo San Juan', 'nodo san juan', 'san-juan', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('be363dca-11b8-5407-91d6-0bf4b5d8aab0'::uuid, 'bd842458-a293-5743-98cf-1292fcb79039'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('be363dca-11b8-5407-91d6-0bf4b5d8aab0'::uuid, 'San Juan', 'san juan')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('be363dca-11b8-5407-91d6-0bf4b5d8aab0'::uuid, 'Nodo San Juan', 'nodo san juan')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('77018325-363a-5122-b248-9fe97631b1aa'::uuid, 47, 'Nodo San Luis', 'nodo san luis', 'san-luis', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('77018325-363a-5122-b248-9fe97631b1aa'::uuid, '3ae324cb-ad5b-595c-955f-9d54d26c8f3e'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('77018325-363a-5122-b248-9fe97631b1aa'::uuid, 'San Luis', 'san luis')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('77018325-363a-5122-b248-9fe97631b1aa'::uuid, 'Nodo San Luis', 'nodo san luis')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('510dd709-e1a5-5e56-9d20-99b0763760a4'::uuid, 48, 'Nodo San Martin', 'nodo san martin', 'san-martin', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('510dd709-e1a5-5e56-9d20-99b0763760a4'::uuid, '6812dbf4-d5c9-546c-9401-390e72ce6fb1'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('510dd709-e1a5-5e56-9d20-99b0763760a4'::uuid, 'San Martin', 'san martin')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('510dd709-e1a5-5e56-9d20-99b0763760a4'::uuid, 'General San Martín', 'general san martin')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('510dd709-e1a5-5e56-9d20-99b0763760a4'::uuid, 'Nodo San Martin', 'nodo san martin')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('52d7a7b5-353c-5a6c-b0aa-c0ac88575f21'::uuid, 49, 'Nodo San Miguel PBA', 'nodo san miguel pba', 'san-miguel-pba', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('52d7a7b5-353c-5a6c-b0aa-c0ac88575f21'::uuid, '1a2cafe8-5b4d-5f21-8c30-f2454be2aee7'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('52d7a7b5-353c-5a6c-b0aa-c0ac88575f21'::uuid, 'San Miguel PBA', 'san miguel pba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('52d7a7b5-353c-5a6c-b0aa-c0ac88575f21'::uuid, 'San Miguel', 'san miguel')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('52d7a7b5-353c-5a6c-b0aa-c0ac88575f21'::uuid, 'Nodo San Miguel PBA', 'nodo san miguel pba')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('c8f7fc2d-a07b-57ce-9a81-a8078951c8bc'::uuid, 50, 'Nodo San Vicente', 'nodo san vicente', 'san-vicente', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('c8f7fc2d-a07b-57ce-9a81-a8078951c8bc'::uuid, 'b062ed98-0cc6-5f04-9674-40a8945d9909'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c8f7fc2d-a07b-57ce-9a81-a8078951c8bc'::uuid, 'San Vicente', 'san vicente')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('c8f7fc2d-a07b-57ce-9a81-a8078951c8bc'::uuid, 'Nodo San Vicente', 'nodo san vicente')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('d781831e-0b50-551e-83cb-d77b73866cdc'::uuid, 51, 'Nodo Tandil', 'nodo tandil', 'tandil', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('d781831e-0b50-551e-83cb-d77b73866cdc'::uuid, '875659de-6368-5b72-88d0-c7e0b516ecf5'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('d781831e-0b50-551e-83cb-d77b73866cdc'::uuid, 'Tandil', 'tandil')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('d781831e-0b50-551e-83cb-d77b73866cdc'::uuid, 'Nodo Tandil', 'nodo tandil')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('5749af4d-1376-5230-8082-dd16ceab7bdc'::uuid, 52, 'Nodo Tierra del Fuego', 'nodo tierra del fuego', 'tierra-del-fuego', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('5749af4d-1376-5230-8082-dd16ceab7bdc'::uuid, 'cfc371d4-3627-547e-a017-418a5eb97b81'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('5749af4d-1376-5230-8082-dd16ceab7bdc'::uuid, 'Tierra del Fuego', 'tierra del fuego')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('5749af4d-1376-5230-8082-dd16ceab7bdc'::uuid, 'Tierra del Fuego, Antártida e Islas del Atlántico Sur', 'tierra del fuego antartida e islas del atlantico sur')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('5749af4d-1376-5230-8082-dd16ceab7bdc'::uuid, 'Nodo Tierra del Fuego', 'nodo tierra del fuego')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO nodes
(id, node_number, name, normalized_name, slug, status)
VALUES
('1ac19af3-a0a7-5325-a589-39739e63d703'::uuid, 53, 'Nodo Vicente Lopez', 'nodo vicente lopez', 'vicente-lopez', 'active')
ON CONFLICT (id) DO UPDATE
SET node_number = EXCLUDED.node_number,
    name = EXCLUDED.name,
    normalized_name = EXCLUDED.normalized_name,
    slug = EXCLUDED.slug,
    updated_at = now();

INSERT INTO node_jurisdictions(node_id, jurisdiction_id, is_primary)
VALUES ('1ac19af3-a0a7-5325-a589-39739e63d703'::uuid, 'f25a6834-8a61-5fbb-82ea-e23deb152a47'::uuid, true)
ON CONFLICT (node_id, jurisdiction_id) DO UPDATE
SET is_primary = true;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('1ac19af3-a0a7-5325-a589-39739e63d703'::uuid, 'Vicente Lopez', 'vicente lopez')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('1ac19af3-a0a7-5325-a589-39739e63d703'::uuid, 'Vicente López', 'vicente lopez')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO node_aliases(node_id, alias, normalized_alias)
VALUES ('1ac19af3-a0a7-5325-a589-39739e63d703'::uuid, 'Nodo Vicente Lopez', 'nodo vicente lopez')
ON CONFLICT (node_id, normalized_alias) DO NOTHING;
INSERT INTO jurisdiction_aliases(jurisdiction_id, alias, normalized_alias)
VALUES
('b8cb65c1-349a-5fcc-b4f7-2a85d967fa29'::uuid, '3 de Febrero', '3 de febrero')
ON CONFLICT (jurisdiction_id, normalized_alias) DO NOTHING;
INSERT INTO jurisdiction_aliases(jurisdiction_id, alias, normalized_alias)
VALUES
('5bc19df2-de8d-5e7d-a47e-55073e63788b'::uuid, 'CABA', 'caba')
ON CONFLICT (jurisdiction_id, normalized_alias) DO NOTHING;

-- Fuentes iniciales conocidas
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('ec01d3a7-86d2-5c3e-8f6a-eb287a790607'::uuid, 'Nodos.xlsx', 'spreadsheet', 'Listado inicial de nodos del MP25M y jurisdicciones asociadas.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('8663b902-e27d-52b0-8ec9-574b4950fa22'::uuid, 'Jurisdicciones_con_Latitud_Longitud.xlsx', 'spreadsheet', 'Coordenadas geográficas de las jurisdicciones vinculadas a nodos.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('dd57235f-82c1-53af-af34-b27b06eb592f'::uuid, 'Persona-Nodo.xlsx', 'spreadsheet', 'Matriz inicial para asociar personas, nodos y tipos de participación.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('50b8cbfb-d98e-5be9-8f31-301f70a3fd3d'::uuid, 'Participantes).xlsx', 'spreadsheet', 'Respuestas iniciales de participantes.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('53e33361-3264-5a73-b7b8-02bac3af062f'::uuid, 'Datos Wasap MP25M Actualizados.xlsx', 'whatsapp', 'Consolidado inicial de contactos provenientes de WhatsApp.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('f09e15d8-5775-5a97-b1ad-c69ba315ff27'::uuid, 'Formato Exxel.xlsx', 'spreadsheet', 'Fichas históricas de nodos, integrantes y vectores.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();

-- Otras fuentes ya recibidas, reservadas para etapas posteriores
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('281ab394-3625-5f37-8735-7a952fb24ad7'::uuid, 'Invitados_ Inscripción para emprendedores referidos (respuestas).xlsx', 'form', 'Respuestas de inscripción de emprendedores referidos; origen formulario electrónico exportado a Excel.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('e4ca9046-0612-5814-a13c-21ac6d234605'::uuid, 'Relevamiento.xlsx', 'spreadsheet', 'Relevamiento territorial de organizaciones y actores productivos/institucionales.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('7685f86e-e1b6-5b29-b875-8ba5c196ac9a'::uuid, 'Avellaneda_6.xlsx', 'spreadsheet', 'Relevamiento enriquecido de unidades productivas de Avellaneda.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();
INSERT INTO data_sources(id, name, source_type, description)
VALUES ('2b402925-b51e-5032-a6dc-f008e9f19b8e'::uuid, 'direcciones_Productivas.xlsx', 'spreadsheet', 'Relevamiento productivo enriquecido con direcciones, coordenadas y clasificaciones.')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    source_type = EXCLUDED.source_type,
    description = EXCLUDED.description,
    updated_at = now();

COMMIT;

-- ---------------------------------------------------------------------------
-- COMPROBACIONES RÁPIDAS
-- ---------------------------------------------------------------------------
-- SELECT count(*) AS nodos FROM mp25m.nodes;                     -- esperado: 53
-- SELECT count(*) AS jurisdicciones FROM mp25m.jurisdictions;
-- SELECT node_number, name, slug FROM mp25m.nodes ORDER BY node_number;
-- SELECT n.node_number, n.name, j.name AS jurisdiccion, j.latitude, j.longitude
-- FROM mp25m.nodes n
-- JOIN mp25m.node_jurisdictions nj ON nj.node_id = n.id AND nj.is_primary
-- JOIN mp25m.jurisdictions j ON j.id = nj.jurisdiction_id
-- ORDER BY n.node_number;
