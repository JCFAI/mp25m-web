import postgres from 'postgres';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const databaseUrl = process.env.DATABASE_URL;
const baseUrl = (arg('base-url') || process.env.MP25M_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const search = arg('search');
const personIdArg = arg('person-id');
const days = Number(arg('days') || 30);

if (!databaseUrl) {
  console.error('Falta DATABASE_URL. Es una variable exclusivamente de servidor/administración.');
  process.exit(1);
}
if (!personIdArg && !search) {
  console.error('Usá --person-id <uuid> o --search "Nombre Apellido".');
  process.exit(1);
}
if (!Number.isInteger(days) || days < 1 || days > 365) {
  console.error('--days debe ser un entero entre 1 y 365.');
  process.exit(1);
}

const sql = postgres(databaseUrl, { ssl: 'require', max: 1, prepare: false });

try {
  let personId = personIdArg;
  let displayName = '';

  if (!personId) {
    const q = `%${search}%`;
    const matches = await sql`
      select id::text, display_name
      from mp25m.persons
      where record_status = 'active'
        and (display_name ilike ${q} or normalized_name ilike ${q})
      order by display_name
      limit 20
    `;

    if (matches.length !== 1) {
      console.error(matches.length === 0
        ? 'No se encontraron personas.'
        : 'La búsqueda no es inequívoca. Elegí un UUID con --person-id:');
      for (const m of matches) console.error(`  ${m.id}  ${m.display_name}`);
      process.exitCode = 2;
    } else {
      personId = matches[0].id;
      displayName = matches[0].display_name;
    }
  }

  if (personId) {
    if (!displayName) {
      const rows = await sql`
        select display_name
        from mp25m.persons
        where id = ${personId}::uuid and record_status = 'active'
      `;
      if (rows.length !== 1) throw new Error('La persona no existe o no está activa.');
      displayName = rows[0].display_name;
    }

    const [issued] = await sql`
      select token, token_id::text, expires_at
      from mp25m_private.create_profile_access_token(${personId}::uuid, ${days}, true)
    `;

    console.log(`Persona: ${displayName}`);
    console.log(`Vence:   ${new Date(issued.expires_at).toISOString()}`);
    console.log(`Enlace:  ${baseUrl}/perfil/actualizar#t=${issued.token}`);
    console.log('\nEl token visible se muestra una sola vez; la base conserva únicamente su hash.');
  }
} finally {
  await sql.end({ timeout: 3 });
}
