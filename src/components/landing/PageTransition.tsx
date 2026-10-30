import { useLocation } from 'react-router-dom';

interface Props {
  children: (location: ReturnType<typeof useLocation>) => React.ReactNode;
}

/** Envolvió de ruta que aplica el fade 'page-fade' al montar (ya no por navegación: la key por pathname remontaba el área de trabajo en cada redirect cosmético). */
export default function PageTransition({ children }: Props) {
  const location = useLocation();
  // Sin key={pathname}: el redirect cosmético /civilflowareatrabajo → /uuid remontaba TODA
  // el área (pérdida de pestaña en el primer ingreso a redes). Costo aceptado: el fade corre
  // solo al montar, ya no por navegación (decisión consciente, no regresión pendiente).
  return <div className="page-fade">{children(location)}</div>;
}
