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
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-lg bg-[#1E3A5F] px-5 py-3 text-sm font-semibold text-white hover:bg-[#14263D]"
        >
          Ingresar al sistema
        </Link>
      </section>
    </main>
  );
}
