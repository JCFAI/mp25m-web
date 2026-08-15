'use client';

import { useEffect, useMemo, useState } from 'react';

type CatalogNode = { id: string; number: number | null; name: string; slug: string };
type CatalogRole = { code: string; name: string; description?: string; isInternal: boolean };
type SkillCategory = { code: string; name: string; description?: string };
type CatalogSkill = { id: string; name: string; categoryCode?: string | null; description?: string | null };
type CatalogVector = { id: string; name: string; description?: string | null };

type ProfileNode = {
  participationId: string;
  nodeId: string;
  nodeNumber: number | null;
  nodeName: string;
  verificationStatus: 'pending' | 'confirmed' | 'rejected';
  roles: { code: string; name: string; verificationStatus: string }[];
};

type ProfileSkill = {
  personSkillId: string;
  skillId: string;
  name: string;
  categoryCode?: string | null;
  level: number | null;
  experienceRange?: ExperienceRange | null;
  experienceNotes?: string | null;
  verificationStatus: string;
};

type ProfileVector = {
  personVectorId: string;
  vectorId: string;
  name: string;
  relationType: string;
  nodeId?: string | null;
  verificationStatus: string;
};

type ApiProfile = {
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  residenceProvince?: string | null;
  residenceLocality?: string | null;
  primaryActivity?: string | null;
  profession?: string | null;
  experience?: string | null;
  contacts: { id: string; type: string; value: string; normalized?: string | null; isPrimary: boolean; visibility: string }[];
  nodes: ProfileNode[];
  skills: ProfileSkill[];
  vectors: ProfileVector[];
  consents: { type: string; status: string }[];
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  formVersion?: string;
  profile?: ApiProfile;
  catalogs?: {
    nodes: CatalogNode[];
    roles: CatalogRole[];
    skillCategories: SkillCategory[];
    skills: CatalogSkill[];
    vectors: CatalogVector[];
  };
};

type ExperienceRange = 'lt_1' | '1_3' | '4_7' | '8_15' | 'gt_15' | 'unspecified';

type SkillState = {
  skillId: string;
  level: number;
  experienceRange: ExperienceRange;
  experienceNotes: string;
  verificationStatus?: string;
};

type SuggestionState = {
  name: string;
  categoryCode: string;
  level: number;
  experienceRange: ExperienceRange;
  description: string;
};

type VectorState = {
  vectorId: string;
  relationType: 'participates' | 'interested';
  nodeId: string;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://oxjlutntlaggbsdwtawn.supabase.co';
const GET_URL = `${SUPABASE_URL}/functions/v1/mp25m-profile-get`;
const SUBMIT_URL = `${SUPABASE_URL}/functions/v1/mp25m-profile-submit`;

const STEP_TITLES = ['Tus datos', 'Tus nodos', 'Experiencia', 'Habilidades', 'Vectores', 'Confirmar'];
const EXPERIENCE_OPTIONS: { value: ExperienceRange; label: string }[] = [
  { value: 'lt_1', label: 'Menos de 1 año' },
  { value: '1_3', label: '1–3 años' },
  { value: '4_7', label: '4–7 años' },
  { value: '8_15', label: '8–15 años' },
  { value: 'gt_15', label: 'Más de 15 años' },
  { value: 'unspecified', label: 'Prefiero no indicar' },
];

function primaryContact(profile: ApiProfile, types: string[]) {
  return profile.contacts.find((c) => c.isPrimary && types.includes(c.type)) ?? profile.contacts.find((c) => types.includes(c.type));
}

function consentGranted(profile: ApiProfile, type: string) {
  return profile.consents.find((c) => c.type === type)?.status === 'granted';
}

function errorText(code?: string) {
  const messages: Record<string, string> = {
    invalid_token: 'El enlace no es válido.',
    invalid_or_expired_token: 'El enlace venció o ya no es válido.',
    invalid_expired_or_used_token: 'El enlace venció o ya fue utilizado.',
    person_not_available: 'No encontramos un perfil activo asociado a este enlace.',
    data_processing_consent_required: 'Necesitamos tu autorización para tratar estos datos.',
  };
  return messages[code ?? ''] ?? 'Ocurrió un problema. Revisá los datos e intentá nuevamente.';
}

export default function ProfileUpdateForm() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState('');
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<ApiProfile | null>(null);
  const [catalogs, setCatalogs] = useState<ApiResponse['catalogs'] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ status: string; reviewItems: number; submissionId: string } | null>(null);

  const [personal, setPersonal] = useState({
    firstName: '', lastName: '', residenceProvince: '', residenceLocality: '', primaryActivity: '', profession: '', experience: '',
  });
  const [contacts, setContacts] = useState({
    phone: '', email: '', phoneVisibleInternal: false, emailVisibleInternal: false,
  });
  const [selectedNodes, setSelectedNodes] = useState<Record<string, string[]>>({});
  const [removedNodeIds, setRemovedNodeIds] = useState<string[]>([]);
  const [skills, setSkills] = useState<SkillState[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
  const [vectors, setVectors] = useState<VectorState[]>([]);
  const [consents, setConsents] = useState({ dataProcessing: false, communications: false, internalDirectory: false, publicProfile: false });
  const [fieldError, setFieldError] = useState('');
  const [skillSearch, setSkillSearch] = useState('');
  const [nodeToAdd, setNodeToAdd] = useState('');

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const t = hash.get('t')?.trim() ?? '';
    if (t) {
      setToken(t);
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    } else {
      setFatalError('Este enlace no contiene un token de actualización válido.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(GET_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
          cache: 'no-store',
        });
        const data: ApiResponse = await response.json();
        if (!response.ok || !data.ok || !data.profile || !data.catalogs) throw new Error(errorText(data.error));
        if (cancelled) return;

        const p = data.profile;
        const phone = primaryContact(p, ['whatsapp', 'phone']);
        const email = primaryContact(p, ['email']);
        const nodeMap: Record<string, string[]> = {};
        p.nodes.forEach((n) => { nodeMap[n.nodeId] = n.roles.map((r) => r.code); });

        setProfile(p);
        setCatalogs(data.catalogs);
        setPersonal({
          firstName: p.firstName ?? '',
          lastName: p.lastName ?? '',
          residenceProvince: p.residenceProvince ?? '',
          residenceLocality: p.residenceLocality ?? '',
          primaryActivity: p.primaryActivity ?? '',
          profession: p.profession ?? '',
          experience: p.experience ?? '',
        });
        setContacts({
          phone: phone?.value ?? '',
          email: email?.value ?? '',
          phoneVisibleInternal: phone?.visibility === 'internal',
          emailVisibleInternal: email?.visibility === 'internal',
        });
        setSelectedNodes(nodeMap);
        setSkills(p.skills.map((s) => ({
          skillId: s.skillId,
          level: s.level ?? 0,
          experienceRange: s.experienceRange ?? 'unspecified',
          experienceNotes: s.experienceNotes ?? '',
          verificationStatus: s.verificationStatus,
        })));
        setVectors(p.vectors
          .filter((v) => v.relationType === 'participates' || v.relationType === 'interested')
          .map((v) => ({ vectorId: v.vectorId, relationType: v.relationType as 'participates' | 'interested', nodeId: v.nodeId ?? '' })));
        setConsents({
          dataProcessing: consentGranted(p, 'data_processing'),
          communications: consentGranted(p, 'communications'),
          internalDirectory: consentGranted(p, 'internal_directory'),
          publicProfile: consentGranted(p, 'public_profile'),
        });
      } catch (e) {
        if (!cancelled) setFatalError(e instanceof Error ? e.message : 'No pudimos cargar tu perfil.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const selectedNodeIds = useMemo(() => Object.keys(selectedNodes), [selectedNodes]);
  const originalNodes = useMemo(() => new Map((profile?.nodes ?? []).map((n) => [n.nodeId, n])), [profile]);
  const skillMap = useMemo(() => new Map((catalogs?.skills ?? []).map((s) => [s.id, s])), [catalogs]);

  const availableSkills = useMemo(() => {
    const used = new Set(skills.map((s) => s.skillId));
    const q = skillSearch.trim().toLowerCase();
    return (catalogs?.skills ?? []).filter((s) => !used.has(s.id) && (!q || s.name.toLowerCase().includes(q))).slice(0, 15);
  }, [catalogs, skills, skillSearch]);

  function toggleExistingNode(nodeId: string, keep: boolean) {
    if (keep) {
      setSelectedNodes((prev) => ({ ...prev, [nodeId]: prev[nodeId] ?? originalNodes.get(nodeId)?.roles.map((r) => r.code) ?? [] }));
      setRemovedNodeIds((prev) => prev.filter((id) => id !== nodeId));
    } else {
      setSelectedNodes((prev) => { const next = { ...prev }; delete next[nodeId]; return next; });
      if (originalNodes.has(nodeId)) setRemovedNodeIds((prev) => prev.includes(nodeId) ? prev : [...prev, nodeId]);
    }
  }

  function addNode() {
    if (!nodeToAdd) return;
    setSelectedNodes((prev) => ({ ...prev, [nodeToAdd]: prev[nodeToAdd] ?? [] }));
    setRemovedNodeIds((prev) => prev.filter((id) => id !== nodeToAdd));
    setNodeToAdd('');
  }

  function toggleRole(nodeId: string, role: string) {
    setSelectedNodes((prev) => {
      const current = new Set(prev[nodeId] ?? []);
      current.has(role) ? current.delete(role) : current.add(role);
      return { ...prev, [nodeId]: [...current] };
    });
  }

  function addSkill(skillId: string) {
    if (skills.some((s) => s.skillId === skillId)) return;
    setSkills((prev) => [...prev, { skillId, level: 3, experienceRange: 'unspecified', experienceNotes: '' }]);
    setSkillSearch('');
  }

  function updateSkill(skillId: string, patch: Partial<SkillState>) {
    setSkills((prev) => prev.map((s) => s.skillId === skillId ? { ...s, ...patch } : s));
  }

  function toggleVector(vectorId: string, relationType: 'participates' | 'interested') {
    const exists = vectors.some((v) => v.vectorId === vectorId && v.relationType === relationType);
    setVectors((prev) => exists
      ? prev.filter((v) => !(v.vectorId === vectorId && v.relationType === relationType))
      : [...prev, { vectorId, relationType, nodeId: '' }]);
  }

  function setVectorNode(vectorId: string, relationType: 'participates' | 'interested', nodeId: string) {
    setVectors((prev) => prev.map((v) => v.vectorId === vectorId && v.relationType === relationType ? { ...v, nodeId } : v));
  }

  function validateStep(current: number) {
    if (current === 0) {
      if (!personal.firstName.trim() || !personal.lastName.trim()) return 'Completá nombre y apellido.';
      if (!contacts.phone.trim()) return 'Completá tu celular/WhatsApp con característica.';
    }
    if (current === 3 && skills.some((s) => s.level < 1 || s.level > 5)) return 'Indicá un nivel entre 1 y 5 para cada habilidad.';
    if (current === 5 && !consents.dataProcessing) return 'Necesitamos tu autorización para almacenar y utilizar estos datos dentro del MP25M.';
    return '';
  }

  function next() {
    const error = validateStep(step);
    if (error) return setFieldError(error);
    setFieldError('');
    setStep((s) => Math.min(5, s + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submit() {
    const error = validateStep(5);
    if (error) return setFieldError(error);
    setSubmitting(true);
    setFieldError('');
    try {
      const data = {
        personal,
        contacts: {
          phone: { value: contacts.phone, visibleInternal: contacts.phoneVisibleInternal },
          email: { value: contacts.email || null, visibleInternal: contacts.emailVisibleInternal },
        },
        nodes: selectedNodeIds.map((nodeId) => ({ nodeId, roles: selectedNodes[nodeId] ?? [] })),
        removedNodeIds,
        skills: skills.map(({ skillId, level, experienceRange, experienceNotes }) => ({ skillId, level, experienceRange, experienceNotes })),
        skillSuggestions: suggestions.map((s) => ({ ...s, categoryCode: s.categoryCode || null })),
        vectors: vectors.map((v) => ({ ...v, nodeId: v.nodeId || null })),
        consents,
      };

      const response = await fetch(SUBMIT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, formVersion: '1.0', data }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(errorText(result.error));
      setSubmitted({ status: result.status, reviewItems: result.reviewItems ?? 0, submissionId: result.submissionId });
      setToken('');
    } catch (e) {
      setFieldError(e instanceof Error ? e.message : 'No pudimos guardar los cambios.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="pf-shell"><div className="pf-card pf-loading">Cargando tu perfil…</div></main>;
  if (fatalError) return <main className="pf-shell"><div className="pf-card"><h1>No pudimos abrir el formulario</h1><p>{fatalError}</p></div></main>;
  if (!profile || !catalogs) return null;

  if (submitted) {
    return (
      <main className="pf-shell">
        <section className="pf-card pf-success">
          <div className="pf-success-icon">✓</div>
          <h1>¡Gracias! Tu perfil fue actualizado.</h1>
          <p>Los datos personales, habilidades y preferencias seguras ya quedaron registrados.</p>
          {submitted.reviewItems > 0 && <p><strong>{submitted.reviewItems}</strong> cambio(s) quedaron pendientes de revisión, principalmente nodos, roles o nuevas habilidades.</p>}
          <div className="pf-summary-box"><span>Identificador del envío</span><code>{submitted.submissionId}</code></div>
        </section>
      </main>
    );
  }

  return (
    <main className="pf-shell">
      <section className="pf-card">
        <header className="pf-header">
          <div className="pf-brand">MP25M</div>
          <div>
            <h1>Actualizá tu perfil</h1>
            <p>Hola, <strong>{profile.displayName}</strong>. Revisá lo que ya sabemos y completá lo que falta.</p>
          </div>
        </header>

        <ol className="pf-steps" aria-label="Progreso del formulario">
          {STEP_TITLES.map((title, index) => (
            <li key={title} className={index === step ? 'active' : index < step ? 'done' : ''}>
              <button type="button" onClick={() => index < step && setStep(index)} disabled={index > step} aria-current={index === step ? 'step' : undefined}>
                <span>{index < step ? '✓' : index + 1}</span><em>{title}</em>
              </button>
            </li>
          ))}
        </ol>

        {step === 0 && (
          <div className="pf-section">
            <h2>1. Tus datos</h2>
            <p className="pf-help">Estos datos nos permiten identificarte y mantener actualizado tu perfil.</p>
            <div className="pf-grid-2">
              <label>Nombre/s<input value={personal.firstName} onChange={(e) => setPersonal({ ...personal, firstName: e.target.value })} /></label>
              <label>Apellido/s<input value={personal.lastName} onChange={(e) => setPersonal({ ...personal, lastName: e.target.value })} /></label>
              <label>Provincia<input value={personal.residenceProvince} onChange={(e) => setPersonal({ ...personal, residenceProvince: e.target.value })} placeholder="Ej.: Buenos Aires" /></label>
              <label>Localidad<input value={personal.residenceLocality} onChange={(e) => setPersonal({ ...personal, residenceLocality: e.target.value })} placeholder="Ej.: Avellaneda" /></label>
              <label>Celular / WhatsApp<input value={contacts.phone} onChange={(e) => setContacts({ ...contacts, phone: e.target.value })} inputMode="tel" placeholder="Con característica, sin 15" /></label>
              <label>Correo electrónico<input value={contacts.email} onChange={(e) => setContacts({ ...contacts, email: e.target.value })} inputMode="email" placeholder="Opcional" /></label>
            </div>
            <div className="pf-visibility">
              <label><input type="checkbox" checked={contacts.phoneVisibleInternal} onChange={(e) => setContacts({ ...contacts, phoneVisibleInternal: e.target.checked })} /> Permitir que mi teléfono sea visible dentro del MP25M</label>
              <label><input type="checkbox" checked={contacts.emailVisibleInternal} onChange={(e) => setContacts({ ...contacts, emailVisibleInternal: e.target.checked })} /> Permitir que mi email sea visible dentro del MP25M</label>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="pf-section">
            <h2>2. Tus nodos y participación</h2>
            <p className="pf-help">Residencia y nodo no son lo mismo. Confirmá los nodos donde efectivamente participás.</p>
            <div className="pf-list">
              {(profile.nodes ?? []).map((node) => {
                const selected = !!selectedNodes[node.nodeId];
                return <article key={node.nodeId} className="pf-item">
                  <div className="pf-item-head"><div><strong>{node.nodeName}</strong><small>{node.verificationStatus === 'confirmed' ? 'Participación confirmada' : 'Pendiente de validación'}</small></div><label className="pf-switch-label"><input type="checkbox" checked={selected} onChange={(e) => toggleExistingNode(node.nodeId, e.target.checked)} /> Sigo participando</label></div>
                  {selected && <div className="pf-role-box"><span>¿Qué función cumplís?</span>{catalogs.roles.map((role) => <label key={role.code}><input type="checkbox" checked={(selectedNodes[node.nodeId] ?? []).includes(role.code)} onChange={() => toggleRole(node.nodeId, role.code)} /> {role.name}</label>)}</div>}
                </article>;
              })}
            </div>
            <div className="pf-add-row">
              <select value={nodeToAdd} onChange={(e) => setNodeToAdd(e.target.value)}><option value="">Agregar otro nodo…</option>{catalogs.nodes.filter((n) => !selectedNodeIds.includes(n.id) && !originalNodes.has(n.id)).map((n) => <option key={n.id} value={n.id}>{n.number ? `${n.number}. ` : ''}{n.name}</option>)}</select>
              <button type="button" className="pf-secondary" onClick={addNode} disabled={!nodeToAdd}>Agregar</button>
            </div>
            {selectedNodeIds.filter((id) => !originalNodes.has(id)).map((id) => {
              const n = catalogs.nodes.find((x) => x.id === id)!;
              return <article key={id} className="pf-item pf-new"><div className="pf-item-head"><div><strong>{n.name}</strong><small>Nuevo — quedará pendiente de confirmación</small></div><button type="button" className="pf-link-danger" onClick={() => toggleExistingNode(id, false)}>Quitar</button></div><div className="pf-role-box"><span>¿Qué función cumplís?</span>{catalogs.roles.map((role) => <label key={role.code}><input type="checkbox" checked={(selectedNodes[id] ?? []).includes(role.code)} onChange={() => toggleRole(id, role.code)} /> {role.name}</label>)}</div></article>;
            })}
          </div>
        )}

        {step === 2 && (
          <div className="pf-section">
            <h2>3. Actividad y experiencia</h2>
            <p className="pf-help">Esto da contexto a tus capacidades. No convierte automáticamente profesión o rubro en una habilidad.</p>
            <label>Actividad principal actual<textarea rows={3} value={personal.primaryActivity} onChange={(e) => setPersonal({ ...personal, primaryActivity: e.target.value })} placeholder="¿A qué te dedicás actualmente?" /></label>
            <label>Profesión u oficio<input value={personal.profession} onChange={(e) => setPersonal({ ...personal, profession: e.target.value })} placeholder="Opcional" /></label>
            <label>Breve descripción de tu experiencia<textarea rows={5} value={personal.experience} onChange={(e) => setPersonal({ ...personal, experience: e.target.value })} placeholder="Sectores, proyectos, tareas, años de experiencia, etc." /></label>
          </div>
        )}

        {step === 3 && (
          <div className="pf-section">
            <h2>4. Tus habilidades</h2>
            <p className="pf-help">Una habilidad es algo que sabés hacer o un campo donde tenés experiencia concreta.</p>
            <div className="pf-skill-list">
              {skills.map((s) => {
                const info = skillMap.get(s.skillId);
                return <article className="pf-skill" key={s.skillId}><div className="pf-item-head"><div><strong>{info?.name ?? 'Habilidad'}</strong>{s.verificationStatus === 'confirmed' && <small>✓ Confirmada</small>}</div><button type="button" className="pf-link-danger" onClick={() => setSkills((prev) => prev.filter((x) => x.skillId !== s.skillId))}>Quitar</button></div><label>Nivel<div className="pf-levels">{[1,2,3,4,5].map((level) => <button type="button" key={level} className={s.level === level ? 'active' : ''} onClick={() => updateSkill(s.skillId,{ level })}>{level}</button>)}</div></label><label>Experiencia<select value={s.experienceRange} onChange={(e) => updateSkill(s.skillId,{ experienceRange: e.target.value as ExperienceRange })}>{EXPERIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label><label>Comentario opcional<textarea rows={2} value={s.experienceNotes} onChange={(e) => updateSkill(s.skillId,{ experienceNotes:e.target.value })} placeholder="Dónde o cómo adquiriste esta experiencia" /></label></article>;
              })}
            </div>
            <div className="pf-search-box"><input value={skillSearch} onChange={(e) => setSkillSearch(e.target.value)} placeholder="Buscar una habilidad para agregar…" />{skillSearch && <div className="pf-search-results">{availableSkills.map((s) => <button type="button" key={s.id} onClick={() => addSkill(s.id)}><strong>{s.name}</strong><small>{catalogs.skillCategories.find((c) => c.code === s.categoryCode)?.name}</small></button>)}</div>}</div>
            <details className="pf-details"><summary>+ Mi habilidad no está en la lista</summary><button type="button" className="pf-secondary" onClick={() => setSuggestions((prev) => [...prev,{ name:'',categoryCode:'',level:3,experienceRange:'unspecified',description:'' }])}>Proponer una nueva habilidad</button>{suggestions.map((s,i) => <div className="pf-suggestion" key={i}><label>Nombre<input value={s.name} onChange={(e) => setSuggestions((prev) => prev.map((x,j) => j===i ? {...x,name:e.target.value}:x))} placeholder="Ej.: Programación PLC Siemens" /></label><div className="pf-grid-2"><label>Categoría<select value={s.categoryCode} onChange={(e) => setSuggestions((prev) => prev.map((x,j) => j===i ? {...x,categoryCode:e.target.value}:x))}><option value="">Sin categoría</option>{catalogs.skillCategories.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label><label>Nivel<select value={s.level} onChange={(e) => setSuggestions((prev) => prev.map((x,j) => j===i ? {...x,level:Number(e.target.value)}:x))}>{[1,2,3,4,5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label></div><label>Descripción<textarea rows={2} value={s.description} onChange={(e) => setSuggestions((prev) => prev.map((x,j) => j===i ? {...x,description:e.target.value}:x))} /></label><button type="button" className="pf-link-danger" onClick={() => setSuggestions((prev) => prev.filter((_,j) => j!==i))}>Eliminar propuesta</button></div>)}</details>
          </div>
        )}

        {step === 4 && (
          <div className="pf-section">
            <h2>5. Vectores del MP25M</h2>
            <p className="pf-help">Separá lo que hacés actualmente de aquello en lo que te interesaría participar.</p>
            <div className="pf-vector-list">{catalogs.vectors.map((v) => { const current = vectors.find((x) => x.vectorId===v.id && x.relationType==='participates'); const interested = vectors.find((x) => x.vectorId===v.id && x.relationType==='interested'); return <article className="pf-vector" key={v.id}><strong>{v.name}</strong><div className="pf-vector-options"><label><input type="checkbox" checked={!!current} onChange={() => toggleVector(v.id,'participates')} /> Participo actualmente</label><label><input type="checkbox" checked={!!interested} onChange={() => toggleVector(v.id,'interested')} /> Me interesa participar</label></div>{[current,interested].filter(Boolean).map((rel) => <label className="pf-node-scope" key={rel!.relationType}>Nodo para “{rel!.relationType==='participates'?'participo':'me interesa'}”<select value={rel!.nodeId} onChange={(e) => setVectorNode(v.id,rel!.relationType,e.target.value)}><option value="">Transversal / varios nodos</option>{selectedNodeIds.map((id) => <option key={id} value={id}>{catalogs.nodes.find((n) => n.id===id)?.name ?? id}</option>)}</select></label>)}</article>; })}</div>
            {(profile.vectors ?? []).some((v) => v.relationType==='participates_or_interested') && <div className="pf-note">Tenías algunos vectores provenientes del formulario anterior que no distinguían entre participación e interés. Elegí arriba la opción correcta para actualizarlos.</div>}
          </div>
        )}

        {step === 5 && (
          <div className="pf-section">
            <h2>6. Revisá y confirmá</h2>
            <div className="pf-review-grid"><div><span>Nombre</span><strong>{personal.firstName} {personal.lastName}</strong></div><div><span>Nodos</span><strong>{selectedNodeIds.length}</strong></div><div><span>Habilidades</span><strong>{skills.length}{suggestions.length ? ` + ${suggestions.length} propuesta(s)` : ''}</strong></div><div><span>Vectores</span><strong>{vectors.length}</strong></div></div>
            <div className="pf-consents"><label className="required"><input type="checkbox" checked={consents.dataProcessing} onChange={(e) => setConsents({ ...consents, dataProcessing:e.target.checked })} /> Autorizo al MP25M a almacenar y utilizar estos datos para sus actividades y herramientas internas.</label><label><input type="checkbox" checked={consents.communications} onChange={(e) => setConsents({ ...consents, communications:e.target.checked })} /> Autorizo recibir comunicaciones del MP25M.</label><label><input type="checkbox" checked={consents.internalDirectory} onChange={(e) => setConsents({ ...consents, internalDirectory:e.target.checked })} /> Autorizo que otros participantes habilitados consulten mi perfil profesional y habilidades.</label><label><input type="checkbox" checked={consents.publicProfile} onChange={(e) => setConsents({ ...consents, publicProfile:e.target.checked })} /> Autorizo que mi perfil profesional pueda aparecer en herramientas públicas del MP25M.</label></div>
            <p className="pf-privacy">Tu teléfono y tu email permanecen privados salvo que hayas autorizado expresamente su visibilidad interna.</p>
          </div>
        )}

        {fieldError && <div className="pf-error" role="alert">{fieldError}</div>}
        <footer className="pf-actions">
          <button type="button" className="pf-secondary" onClick={() => { setFieldError(''); setStep((s) => Math.max(0,s-1)); }} disabled={step===0 || submitting}>Atrás</button>
          {step < 5 ? <button type="button" className="pf-primary" onClick={next}>Continuar</button> : <button type="button" className="pf-primary" onClick={submit} disabled={submitting}>{submitting ? 'Guardando…' : 'Actualizar mi perfil'}</button>}
        </footer>
      </section>
    </main>
  );
}
