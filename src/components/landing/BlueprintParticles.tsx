import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  type: 'cross' | 'dot';
  alpha: number;
  baseX: number;
  baseY: number;
  angle: number;
  speed: number;
}

export default function BlueprintParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let mouseX = -1000;
    let mouseY = -1000;
    
    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
      // Use parent container dimensions
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      initParticles();
      if (prefersReducedMotion) {
        drawParticles(); // Draw once and stop
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    const initParticles = () => {
      particles = [];
      const numParticles = 30; // ~30 particles
      for (let i = 0; i < numParticles; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.2, // very slow
          vy: (Math.random() - 0.5) * 0.2,
          size: Math.random() > 0.5 ? 2 : 4, // 2 for dots, 4 for crosses
          type: Math.random() > 0.6 ? 'cross' : 'dot',
          alpha: Math.random() * 0.3 + 0.1, // 0.1 to 0.4 opacity
          baseX: 0,
          baseY: 0,
          angle: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.01 + 0.005
        });
        particles[i].baseX = particles[i].x;
        particles[i].baseY = particles[i].y;
      }
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.globalAlpha = p.alpha;
        ctx.strokeStyle = '#00dce5'; // Cyan/blue tone
        ctx.fillStyle = '#00dce5';
        
        if (p.type === 'cross') {
          ctx.beginPath();
          ctx.moveTo(-p.size, 0);
          ctx.lineTo(p.size, 0);
          ctx.moveTo(0, -p.size);
          ctx.lineTo(0, p.size);
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
    };

    const animate = () => {
      if (prefersReducedMotion) return; // Should not reach here if reduced, but safeguard
      
      particles.forEach(p => {
        // Linear drift
        p.baseX += p.vx;
        p.baseY += p.vy;
        
        // Sine wave oscillation
        p.angle += p.speed;
        p.x = p.baseX + Math.sin(p.angle) * 20;
        p.y = p.baseY + Math.cos(p.angle * 0.8) * 20; // Slightly different phase

        // Mouse attraction
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 200 && dist > 0) {
          p.baseX += (dx / dist) * 0.3; // Gentle pull
          p.baseY += (dy / dist) * 0.3;
        }

        // Wrap around
        if (p.baseX > canvas.width + 20) p.baseX = -20;
        if (p.baseX < -20) p.baseX = canvas.width + 20;
        if (p.baseY > canvas.height + 20) p.baseY = -20;
        if (p.baseY < -20) p.baseY = canvas.height + 20;
      });

      drawParticles();

      // Draw constellation lines
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < 150) {
            const alpha = (1 - dist / 150) * 0.15; // Max opacity 0.15
            ctx.strokeStyle = `rgba(0, 220, 229, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    const parentNode = canvas.parentElement;
    if (parentNode) {
      parentNode.addEventListener('mousemove', handleMouseMove);
      parentNode.addEventListener('mouseleave', handleMouseLeave);
    }
    resize(); // Will call initParticles and draw once
    
    if (!prefersReducedMotion) {
      animate();
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (parentNode) {
        parentNode.removeEventListener('mousemove', handleMouseMove);
        parentNode.removeEventListener('mouseleave', handleMouseLeave);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }} // Adjust overall opacity if needed
    />
  );
}
