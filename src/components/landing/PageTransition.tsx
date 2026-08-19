import { useLocation } from 'react-router-dom';

interface Props {
  children: (location: ReturnType<typeof useLocation>) => React.ReactNode;
}

export default function PageTransition({ children }: Props) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-fade">
      {children(location)}
    </div>
  );
}
