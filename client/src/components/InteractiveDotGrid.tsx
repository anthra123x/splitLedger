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
  /** Enable continuous autonomous ambient wave motion without requiring mouse */
  autonomous?: boolean;
}

interface Dot {
  baseX: number;
  baseY: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  intensity: number; // 0 to 1 for subtle glow/highlight
}

export default function InteractiveDotGrid({
  spacing = 28,
  dotRadius = 1.35,
  interactionRadius = 140,
  maxDisplacement = 18,
  autonomous = false
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
      if (autonomous) {
        startLoop();
      }
    };

    const drawDots = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Batch 1: Standard resting dots (intensity <= 0.05)
      ctx.beginPath();
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (d.intensity <= 0.05) {
          ctx.moveTo(d.x + dotRadius, d.y);
          ctx.arc(d.x, d.y, dotRadius, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
      ctx.fill();

      // Batch 2: Ambient wave glow dots (0.05 < intensity <= 0.35)
      ctx.beginPath();
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (d.intensity > 0.05 && d.intensity <= 0.35) {
          const r = dotRadius + d.intensity * 0.6;
          ctx.moveTo(d.x + r, d.y);
          ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      ctx.fill();

      // Batch 3: Active crest & cursor interaction dots (intensity > 0.35)
      ctx.beginPath();
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        if (d.intensity > 0.35) {
          const r = dotRadius + d.intensity * 1.1;
          ctx.moveTo(d.x + r, d.y);
          ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
        }
      }
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fill();
    };

    const updateDots = () => {
      const time = performance.now() * 0.001;

      // Smooth mouse tracking
      mouse.x += (mouse.targetX - mouse.x) * 0.22;
      mouse.y += (mouse.targetY - mouse.y) * 0.22;

      let maxDelta = 0;

      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];

        // Autonomous harmonic wave calculations
        let autoDispX = 0;
        let autoDispY = 0;
        let autoIntensity = 0;

        if (autonomous) {
          const wave1 = Math.sin(time * 1.4 + d.baseX * 0.007 + d.baseY * 0.005);
          const wave2 = Math.cos(time * 1.0 - d.baseX * 0.005 + d.baseY * 0.008);
          const combinedWave = (wave1 + wave2) * 0.5;

          autoDispX = Math.cos(time * 1.1 + d.baseY * 0.012) * 3.5;
          autoDispY = Math.sin(time * 0.9 + d.baseX * 0.012) * 3.5;
          autoIntensity = Math.max(0, (combinedWave + 0.3) * 0.45);
        }

        // Cursor repulsion and interaction calculations
        let mouseDispX = 0;
        let mouseDispY = 0;
        let mouseIntensity = 0;

        if (mouse.active) {
          const dx = mouse.x - d.baseX;
          const dy = mouse.y - d.baseY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < interactionRadius && dist > 0.001) {
            const factor = 1 - dist / interactionRadius;
            const push = Math.sin(factor * Math.PI * 0.5) * maxDisplacement;
            const angle = Math.atan2(dy, dx);
            mouseDispX = -Math.cos(angle) * push;
            mouseDispY = -Math.sin(angle) * push;
            mouseIntensity = factor;
          }
        }

        d.targetX = d.baseX + autoDispX + mouseDispX;
        d.targetY = d.baseY + autoDispY + mouseDispY;

        const targetIntensity = Math.min(1, Math.max(autoIntensity, mouseIntensity));
        d.intensity += (targetIntensity - d.intensity) * (autonomous ? 0.18 : 0.2);

        // Fluid spring interpolation back to target
        const diffX = d.targetX - d.x;
        const diffY = d.targetY - d.y;
        d.x += diffX * 0.2;
        d.y += diffY * 0.2;

        const delta = Math.abs(diffX) + Math.abs(diffY);
        if (delta > maxDelta) {
          maxDelta = delta;
        }
      }

      drawDots();

      // If settled and non-autonomous, pause loop to conserve CPU/battery
      if (!autonomous) {
        if (maxDelta < 0.05 && (!mouse.active || Math.hypot(mouse.targetX - mouse.x, mouse.targetY - mouse.y) < 0.1)) {
          idleCounter++;
          if (idleCounter > 20) {
            isRunning = false;
            return;
          }
        } else {
          idleCounter = 0;
        }
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
  }, [spacing, dotRadius, interactionRadius, maxDisplacement, autonomous]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0"
      style={{ display: 'block' }}
    />
  );
}
