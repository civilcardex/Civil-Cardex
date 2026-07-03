import { useEffect, useState } from 'react';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface Props {
  text: string;
  delay?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function TypewriterText({ text, delay = 800, className, style }: Props) {
  const [displayedText, setDisplayedText] = useState('');
  const [showCursor, setShowCursor] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayedText(text);
      return;
    }

    let timeoutId: number;
    let typeInterval: number;

    timeoutId = setTimeout(() => {
      setShowCursor(true);
      let i = 0;
      typeInterval = window.setInterval(() => {
        setDisplayedText(text.slice(0, i + 1));
        i++;
        if (i >= text.length) {
          clearInterval(typeInterval);
          setTimeout(() => setShowCursor(false), 1500); // Cursor stays for 1.5s after finishing
        }
      }, 50); // Speed of typing
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(typeInterval);
    };
  }, [text, delay]);

  return (
    <p className={className} style={style}>
      {displayedText}
      <span 
        style={{ 
          opacity: showCursor && !prefersReducedMotion ? 1 : 0,
          transition: 'opacity 0.2s',
          animation: showCursor ? 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
        }}
      >|</span>
    </p>
  );
}
