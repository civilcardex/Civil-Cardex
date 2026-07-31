import { useEffect, useRef } from 'react';

export default function RotatingWireframe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let angle = 0;

    // Define a 3D tower structure (points centered around 0,0,0)
    const nodes = [
      // Base
      [-1, -1, -1],
      [1, -1, -1],
      [1, -1, 1],
      [-1, -1, 1],
      // Mid
      [-0.7, 0, -0.7],
      [0.7, 0, -0.7],
      [0.7, 0, 0.7],
      [-0.7, 0, 0.7],
      // Top
      [-0.4, 1, -0.4],
      [0.4, 1, -0.4],
      [0.4, 1, 0.4],
      [-0.4, 1, 0.4],
    ];

    const edges = [
      // Base square
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      // Mid square
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      // Top square
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 8],
      // Vertical connections
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
      [4, 8],
      [5, 9],
      [6, 10],
      [7, 11],
      // Cross bracing
      [0, 5],
      [1, 6],
      [2, 7],
      [3, 4],
      [4, 9],
      [5, 10],
      [6, 11],
      [7, 8],
    ];

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      } else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
      if (prefersReducedMotion) draw();
    };

    const draw = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const scale = Math.min(canvas.width, canvas.height) * 0.25; // Responsive scale

      ctx.strokeStyle = 'rgba(232, 200, 74, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      const projected = nodes.map((node) => {
        const x = node[0];
        const y = node[1] * 1.5; // Stretch Y to make it a tower
        const z = node[2];

        // Rotate around Y axis
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        const rotX = x * cos - z * sin;
        const rotZ = z * cos + x * sin;

        // 3D to 2D projection (Isometric-like)
        // x' = x - z, y' = y + (x + z) / 2
        const projX = cx + (rotX - rotZ) * scale * 0.866;
        const projY = cy + (y + (rotX + rotZ) * 0.5) * scale;

        return { x: projX, y: projY };
      });

      edges.forEach((edge) => {
        const p1 = projected[edge[0]];
        const p2 = projected[edge[1]];
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
      });

      ctx.stroke();

      if (!prefersReducedMotion) {
        angle += 0.003;
        animationId = requestAnimationFrame(draw);
      }
    };

    window.addEventListener('resize', resize);
    resize();
    if (!prefersReducedMotion) draw();

    return () => {
      window.removeEventListener('resize', resize);
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-[3]" />;
}
