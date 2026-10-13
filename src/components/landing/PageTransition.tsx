import { useLocation } from 'react-router-dom';

interface Props {
  children: (location: ReturnType<typeof useLocation>) => React.ReactNode;
}

export default function PageTransition({ children }: Props) {
  const location = useLocation();
  // Sin key={pathname}: el redirect cosmético /civilflowareatrabajo → /uuid remontaba TODA
  // el área (pérdida de pestaña en el primer ingreso a redes). Costo aceptado: el fade corre
  // solo al montar, ya no por navegación (decisión consciente, no regresión pendiente).
  return <div className="page-fade">{children(location)}</div>;
}
