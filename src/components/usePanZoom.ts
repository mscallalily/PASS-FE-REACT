import React, { useCallback, useEffect, useRef, useState } from 'react';

// Pan and zoom an SVG by changing its viewBox: drag to pan, wheel or pinch
// to zoom. Shared by the 2D plan and the 3D-style parking views.

export type Point = [number, number];
export type ViewBox = [number, number, number, number];

/** Fit a box into the given aspect ratio, keeping its centre. */
export function fit([x, y, w, h]: ViewBox, aspect: number): ViewBox {
  const width = Math.max(w, h * aspect);
  const height = width / aspect;
  return [x + (w - width) / 2, y + (h - height) / 2, width, height];
}

export function usePanZoom(svgRef: React.RefObject<SVGSVGElement | null>, home: ViewBox) {
  const [, , baseW, baseH] = home;
  const aspect = baseW / baseH;
  const [view, setView] = useState<ViewBox>(home);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ startView: ViewBox; startPoint: Point; inverse: DOMMatrix; moved: boolean } | null>(null);
  const pinch = useRef<{ distance: number; view: ViewBox; mid: Point } | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => { setView(home); }, [home]);

  const toSvg = useCallback((clientX: number, clientY: number, inverse?: DOMMatrix): Point => {
    const matrix = inverse ?? svgRef.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(clientX, clientY).matrixTransform(matrix);
    return [p.x, p.y];
  }, [svgRef]);

  const zoomAt = useCallback((factor: number, [px, py]: Point, from?: ViewBox) => {
    setView(current => {
      // Every view keeps the home aspect ratio, so height follows width.
      const [x, y, w] = from ?? current;
      const newW = Math.min(baseW * 1.2, Math.max(baseW / 10, w / factor));
      const f = w / newW;
      return [px - (px - x) / f, py - (py - y) / f, newW, newW / aspect];
    });
  }, [aspect, baseW]);

  const zoomCenter = (factor: number) => zoomAt(factor, [view[0] + view[2] / 2, view[1] + view[3] / 2]);
  const focus = useCallback((box: ViewBox) => setView(fit(box, aspect)), [aspect]);
  const reset = useCallback(() => setView(home), [home]);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, toSvg(e.clientX, e.clientY));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef, toSvg, zoomAt]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Capture the hit element so a tap still dispatches its click to the slot.
    // Capturing the outer SVG retargets the click away from interactive bays.
    (e.target as Element).setPointerCapture?.(e.pointerId);

    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        view,
        mid: toSvg((a.x + b.x) / 2, (a.y + b.y) / 2),
      };
      drag.current = null;
    } else {
      const inverse = svgRef.current!.getScreenCTM()!.inverse();
      drag.current = { startView: view, startPoint: toSvg(e.clientX, e.clientY, inverse), inverse, moved: false };
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const factor = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance;
      zoomAt(factor, pinch.current.mid, pinch.current.view);
      suppressClick.current = true;
      return;
    }

    const d = drag.current;
    if (!d) return;
    const [cx, cy] = toSvg(e.clientX, e.clientY, d.inverse);
    const dx = cx - d.startPoint[0];
    const dy = cy - d.startPoint[1];
    if (!d.moved && Math.hypot(dx, dy) * (svgRef.current!.getBoundingClientRect().width / d.startView[2]) < 4) return;
    d.moved = true;
    suppressClick.current = true;
    setView([d.startView[0] - dx, d.startView[1] - dy, d.startView[2], d.startView[3]]);
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) {
      drag.current = null;
      // Let the click that ends a drag be ignored, then re-enable clicks.
      setTimeout(() => { suppressClick.current = false; }, 0);
    }
  };

  return {
    view,
    zoomScale: baseW / view[2],
    zoomCenter,
    focus,
    reset,
    suppressClick,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
