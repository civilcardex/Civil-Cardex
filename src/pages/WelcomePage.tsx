import { Link, useSearchParams } from 'react-router';
import Navbar from '../components/Navbar.tsx';
import { usePageMeta } from '../hooks/usePageMeta.ts';

export default function WelcomePage() {
  usePageMeta('Gracias por tu compra', 'Consulta el estado de tu compra en CivilCardex.', true);
  const [params] = useSearchParams();
  const referencia = params.get('ref');
  const destino = referencia ? `/pricing?${new URLSearchParams({ ref: referencia })}` : '/perfil';

  return (
    <div className="landing-root pricing-root">
      <Navbar />
      <main className="container mx-auto px-6 py-28 text-center">
        <h1 className="pricing-title text-primary">Gracias por tu compra</h1>
        <p className="mx-auto mt-4 max-w-md text-on-surface-variant">
          Puedes consultar el estado de la activación de tus módulos en CivilCardex.
        </p>
        <Link
          to={destino}
          data-destacado="true"
          className="pricing-plan-cta mt-8 inline-block px-6 py-3 font-bold"
        >
          {referencia ? 'Consultar estado del pago' : 'Ir a mi perfil'}
        </Link>
      </main>
    </div>
  );
}
