import { Link } from 'react-router-dom';
import { usePageMeta } from '../hooks/usePageMeta';

export default function NotFound() {
  usePageMeta('Página no encontrada');
  return (
    <div className="min-h-screen bg-surface-bg text-on-surface font-sans flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-gray-400 mb-6">Página no encontrada</p>
        <Link
          to="/"
          className="inline-block px-6 py-3 bg-primary text-on-primary rounded-lg hover:opacity-90 transition-opacity"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
