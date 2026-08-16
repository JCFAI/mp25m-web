import postgres from "npm:postgres@3.4.7";

const dbUrl = Deno.env.get("SUPABASE_DB_URL");
if (!dbUrl) throw new Error("SUPABASE_DB_URL is not configured");

const sql = postgres(dbUrl, {
  prepare: false,
  max: 1,
  idle_timeout: 5,
  connect_timeout: 5,
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const tokenRe = /^[A-Za-z0-9_-]+$/;
const experienceRanges = new Set(["lt_1", "1_3", "4_7", "8_15", "gt_15", "unspecified"]);
const relationTypes = new Set(["participates", "interested"]);
const roleCodes = new Set(["founder", "referent", "participant", "contact"]);

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function valueShape(value: unknown) {
  if (typeof value === "string") return `string(${value.length})`;
  if (value === null) return "null";
  if (Array.isArray(value)) return `array(${value.length})`;
  return typeof value;
}

function payloadShape(data: unknown) {
  if (!isObject(data)) return { data: valueShape(data) };
  const personal = isObject(data.personal) ? data.personal : {};
  const contacts = isObject(data.contacts) ? data.contacts : {};
  const phone = isObject(contacts.phone) ? contacts.phone : {};
  const email = isObject(contacts.email) ? contacts.email : {};
  const consents = isObject(data.consents) ? data.consents : {};

  return {
    personal: Object.fromEntries(Object.entries(personal).map(([key, value]) => [key, valueShape(value)])),
    contacts: {
      phoneValue: valueShape(phone.value),
      phoneVisibleInternal: valueShape(phone.visibleInternal),
      emailValue: valueShape(email.value),
      emailVisibleInternal: valueShape(email.visibleInternal),
    },
    consents: Object.fromEntries(Object.entries(consents).map(([key, value]) => [key, valueShape(value)])),
    nodes: valueShape(data.nodes),
    removedNodeIds: valueShape(data.removedNodeIds),
    skills: valueShape(data.skills),
    skillSuggestions: valueShape(data.skillSuggestions),
    vectors: valueShape(data.vectors),
  };
}

function safeDatabaseError(error: any) {
  const safe: Record<string, string> = {};
  for (const key of ["code", "severity", "schema_name", "table_name", "column_name", "constraint_name", "routine"]) {
    if (typeof error?.[key] === "string" && error[key]) safe[key] = error[key];
  }
  if (typeof error?.message === "string" && error.message) {
    safe.message = error.message
      .replace(/"[^"]*"|'[^']*'/g, '"[redacted]"')
      .slice(0, 240);
  }
  return safe;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validateData(data: Record<string, any>): string | null {
  if (!isObject(data.personal) || !isObject(data.contacts) || !isObject(data.consents)) return "missing_sections";
  if (typeof data.personal.firstName !== "string" || !data.personal.firstName.trim()) return "first_name_required";
  if (typeof data.personal.lastName !== "string" || !data.personal.lastName.trim()) return "last_name_required";
  if (!isObject(data.contacts.phone) || typeof data.contacts.phone.value !== "string" || !data.contacts.phone.value.trim()) return "mobile_phone_required";
  if (data.consents.dataProcessing !== true) return "data_processing_consent_required";

  const nodes = data.nodes ?? [];
  const removed = data.removedNodeIds ?? [];
  const skills = data.skills ?? [];
  const suggestions = data.skillSuggestions ?? [];
  const vectors = data.vectors ?? [];
  if (!Array.isArray(nodes) || nodes.length > 53) return "invalid_nodes";
  if (!Array.isArray(removed) || removed.length > 53) return "invalid_removed_nodes";
  if (!Array.isArray(skills) || skills.length > 200) return "invalid_skills";
  if (!Array.isArray(suggestions) || suggestions.length > 30) return "invalid_skill_suggestions";
  if (!Array.isArray(vectors) || vectors.length > 100) return "invalid_vectors";

  for (const node of nodes) {
    if (!isObject(node) || typeof node.nodeId !== "string" || !uuidRe.test(node.nodeId)) return "invalid_node_id";
    if (node.roles != null && !Array.isArray(node.roles)) return "invalid_roles";
    for (const role of node.roles ?? []) if (typeof role !== "string" || !roleCodes.has(role)) return "invalid_role";
  }
  for (const id of removed) if (typeof id !== "string" || !uuidRe.test(id)) return "invalid_removed_node_id";

  for (const skill of skills) {
    if (!isObject(skill) || typeof skill.skillId !== "string" || !uuidRe.test(skill.skillId)) return "invalid_skill_id";
    if (!Number.isInteger(skill.level) || skill.level < 1 || skill.level > 5) return "invalid_skill_level";
    if (skill.experienceRange != null && skill.experienceRange !== "" && !experienceRanges.has(skill.experienceRange)) return "invalid_experience_range";
  }

  for (const suggestion of suggestions) {
    if (!isObject(suggestion) || typeof suggestion.name !== "string" || !suggestion.name.trim() || suggestion.name.trim().length > 180) return "invalid_skill_suggestion";
    if (suggestion.level != null && (!Number.isInteger(suggestion.level) || suggestion.level < 1 || suggestion.level > 5)) return "invalid_skill_suggestion_level";
    if (suggestion.experienceRange != null && suggestion.experienceRange !== "" && !experienceRanges.has(suggestion.experienceRange)) return "invalid_skill_suggestion_experience";
  }

  for (const vector of vectors) {
    if (!isObject(vector) || typeof vector.vectorId !== "string" || !uuidRe.test(vector.vectorId)) return "invalid_vector_id";
    if (typeof vector.relationType !== "string" || !relationTypes.has(vector.relationType)) return "invalid_vector_relation";
    if (vector.nodeId != null && vector.nodeId !== "" && (typeof vector.nodeId !== "string" || !uuidRe.test(vector.nodeId))) return "invalid_vector_node_id";
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return respond({ ok: false, error: "method_not_allowed" }, 405);

  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > 262_144) return respond({ ok: false, error: "request_too_large" }, 413);

  const requestId = crypto.randomUUID();
  let shape: ReturnType<typeof payloadShape> = { data: "unread" };

  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const formVersion = body?.formVersion === "1.0" ? "1.0" : null;
    const data = body?.data;
    shape = payloadShape(data);

    if (token.length < 32 || token.length > 256 || !tokenRe.test(token)) return respond({ ok: false, error: "invalid_token" }, 401);
    if (!formVersion) return respond({ ok: false, error: "unsupported_form_version" }, 400);
    if (!isObject(data)) return respond({ ok: false, error: "invalid_payload" }, 400);

    const dataSize = new TextEncoder().encode(JSON.stringify(data)).byteLength;
    if (dataSize > 196_608) return respond({ ok: false, error: "payload_too_large" }, 413);

    const validationError = validateData(data);
    if (validationError) return respond({ ok: false, error: validationError }, 400);

    const tokenHash = await sha256Hex(token);
    const rows = await sql`
      select mp25m_private.profile_submit_by_token(${tokenHash}, ${sql.json(data)}::jsonb, ${formVersion}) as result
    `;
    const result = rows[0]?.result ?? { ok: false, error: "submission_unavailable" };

    if (!result.ok) {
      const tokenErrors = new Set(["invalid_expired_or_used_token", "person_not_available"]);
      return respond(result, tokenErrors.has(result.error) ? 401 : 400);
    }

    return respond(result, 200);
  } catch (error: any) {
    const code = typeof error?.code === "string" ? error.code : "";
    if (["22P02", "23503", "23514"].includes(code)) {
      const diagnostic = safeDatabaseError(error);
      console.error("mp25m-profile-submit database rejection", JSON.stringify({ requestId, error: diagnostic, shape }));
      return respond({ ok: false, error: "invalid_payload", requestId }, 400);
    }
    console.error("mp25m-profile-submit failed", JSON.stringify({ requestId, error: safeDatabaseError(error), shape }));
    return respond({ ok: false, error: "internal_error", requestId }, 500);
  }
});
