import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface Props {
  children: (location: ReturnType<typeof useLocation>) => React.ReactNode;
}

export default function PageTransition({ children }: Props) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [transitionStage, setTransitionStage] = useState('fadeIn');
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayLocation(location);
      return;
    }

    if (location.pathname !== displayLocation.pathname) {
      setTransitionStage('fadeOut');
    }
  }, [location, displayLocation, prefersReducedMotion]);

  const handleTransitionEnd = () => {
    if (transitionStage === 'fadeOut') {
      setTransitionStage('fadeIn');
      setDisplayLocation(location);
    }
  };

  if (prefersReducedMotion) {
    return <>{children(location)}</>;
  }

  return (
    <div
      style={{
        opacity: transitionStage === 'fadeIn' ? 1 : 0,
        transform: transitionStage === 'fadeIn' ? 'translateY(0)' : 'translateY(-10px)',
        transition: transitionStage === 'fadeOut' ? 'all 0.2s ease-out' : 'all 0.3s ease-in',
        minHeight: '100vh',
        width: '100%'
      }}
      onTransitionEnd={handleTransitionEnd}
    >
      {children(displayLocation)}
    </div>
  );
}
