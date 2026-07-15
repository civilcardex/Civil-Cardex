import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

const NOTFOUND_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Página no encontrada — CivilCore',
  description: 'La página solicitada no existe. Verifique la URL o vuelva al inicio de CivilCore.',
  url: 'https://civilcore.app/404',
};

export default function NotFound() {
  usePageMeta('Página no encontrada', 'La página solicitada no existe en CivilCore. Verifique la URL o vuelva al inicio.', true);
  return (
    <div className="min-h-screen bg-surface-bg text-on-surface font-sans flex items-center justify-center">
      <script type="application/ld+json">{JSON.stringify(NOTFOUND_JSONLD)}</script>
      <main className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-gray-400 mb-6">Página no encontrada</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity"
        >
          Volver al inicio
        </Link>
      </main>
    </div>
  );
}
