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
    // When reduced motion is on, the render path below uses `location` directly (not
    // displayLocation), so there's nothing to synchronize here.
    if (prefersReducedMotion) return;

    if (location.pathname !== displayLocation.pathname) {
      // Triggers a CSS transition sequence in response to a route change — inherently a
      // side effect over time, not a value derivable during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
