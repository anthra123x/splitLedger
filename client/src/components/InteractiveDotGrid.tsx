import React, { useEffect, useRef } from 'react';

interface InteractiveDotGridProps {
  /** Distance in px between dots in the grid */
  spacing?: number;
  /** Base radius of each dot in px */
  dotRadius?: number;
  /** Radius around mouse where dots react */
  interactionRadius?: number;
  /** Maximum distance in px a dot can be displaced */
  maxDisplacement?: number;
}

interface Dot {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  intensity: number; // 0 to 1 for subtle mouse highlight
}

export default function InteractiveDotGrid({
  spacing = 28,
  dotRadius = 1.35,
  interactionRadius = 140,
  maxDisplacement = 18
}: InteractiveDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let dots: Dot[] = [];
    let width = 0;
    let height = 0;

    const mouse = {
      x: -9999,
      y: -9999,
      targetX: -9999,
      targetY: -9999,
      active: false
    };

    let isRunning = false;
    let idleCounter = 0;

    const buildGrid = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      dots = [];
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const bx = c * spacing;
          const by = r * spacing;
          dots.push({
            baseX: bx,
            baseY: by,
            x: bx,
            y: by,
            targetX: bx,
            targetY: by,
            intensity: 0
          });
        }
      }

      drawDots();
    };

    const drawDots = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Batch normal resting dots for optimal 60fps performance
      ctx.beginPath();
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (d.intensity <= 0.02) {
          ctx.moveTo(d.x + dotRadius, d.y);
          ctx.arc(d.x, d.y, dotRadius, 0, Math.PI * 2);
        }
      }
      // Visible drafting board dot color
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fill();

      // Draw highlighted/active dots reacting to the cursor
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (d.intensity > 0.02) {
          ctx.beginPath();
          const r = dotRadius + d.intensity * 0.9;
          ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
          const alpha = 0.22 + d.intensity * 0.58;
          ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
          ctx.fill();
        }
      }
    };

    const updateDots = () => {
      // Smooth mouse tracking
      mouse.x += (mouse.targetX - mouse.x) * 0.22;
      mouse.y += (mouse.targetY - mouse.y) * 0.22;

      let maxDelta = 0;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];

        if (mouse.active) {
          const dx = mouse.x - d.baseX;
          const dy = mouse.y - d.baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < interactionRadius && dist > 0.001) {
            // Smooth sinusoidal repulsion
            const factor = 1 - dist / interactionRadius;
            const push = Math.sin(factor * Math.PI * 0.5) * maxDisplacement;
            const angle = Math.atan2(dy, dx);

            d.targetX = d.baseX - Math.cos(angle) * push;
            d.targetY = d.baseY - Math.sin(angle) * push;
            d.intensity += (factor - d.intensity) * 0.25;
          } else {
            d.targetX = d.baseX;
            d.targetY = d.baseY;
            d.intensity += (0 - d.intensity) * 0.15;
          }
        } else {
          d.targetX = d.baseX;
          d.targetY = d.baseY;
          d.intensity += (0 - d.intensity) * 0.15;
        }

        // Fluid spring interpolation back to target
        const diffX = d.targetX - d.x;
        const diffY = d.targetY - d.y;
        d.x += diffX * 0.18;
        d.y += diffY * 0.18;

        const delta = Math.abs(diffX) + Math.abs(diffY);
        if (delta > maxDelta) {
          maxDelta = delta;
        }
      }

      drawDots();

      // If settled, pause loop to conserve CPU/battery
      if (maxDelta < 0.05 && (!mouse.active || Math.hypot(mouse.targetX - mouse.x, mouse.targetY - mouse.y) < 0.1)) {
        idleCounter++;
        if (idleCounter > 20) {
          isRunning = false;
          return;
        }
      } else {
        idleCounter = 0;
      }

      animationFrameId = requestAnimationFrame(updateDots);
    };

    const startLoop = () => {
      if (!isRunning) {
        isRunning = true;
        idleCounter = 0;
        animationFrameId = requestAnimationFrame(updateDots);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
      startLoop();
    };

    const handlePointerLeave = () => {
      mouse.active = false;
      mouse.targetX = -9999;
      mouse.targetY = -9999;
      startLoop();
    };

    let resizeTimer: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        buildGrid();
        startLoop();
      }, 100);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('resize', handleResize);

    buildGrid();

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [spacing, dotRadius, interactionRadius, maxDisplacement]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
      style={{ display: 'block' }}
    />
  );
}
