import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="home-shell">
      <section className="home-card">
        <div className="home-mark">MP25M</div>
        <p className="home-kicker">Movimiento Productivo 25 de Mayo</p>
        <h1>Mapa productivo, capacidades y articulaciones</h1>
        <p>
          Esta aplicación permitirá actualizar perfiles, identificar capacidades por nodo y
          fortalecer articulaciones productivas en todo el país.
        </p>
        <div className="home-note">
          Los formularios de actualización se abren mediante un enlace personal enviado por el MP25M.
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex rounded-lg bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14263D]"
          >
            Ingresar al sistema
          </Link>

          <Link
            href="/solicitar-acceso"
            className="inline-flex rounded-lg border border-[#1E3A5F] bg-white px-5 py-3 text-sm font-semibold text-[#1E3A5F] hover:bg-slate-50"
          >
            Crear una cuenta
          </Link>
        </div>
      </section>
    </main>
  );
}
