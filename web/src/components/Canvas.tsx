"use client";
/* ============================================================
   CodeMap — bespoke graph canvas (ported from componentsUI/assets/components.jsx)

   KEPT DELIBERATELY: absolute-positioned nodes + SVG bezier edges +
   custom pan / ⌘-scroll zoom / fit + programmatic camera focus driven by
   `cameraTarget.nonce`. Do NOT swap this for React Flow — the voice layer
   (Step 4) steers the camera by bumping cameraTarget.
   ============================================================ */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import { Icon } from "./Icon";
import type { CodeMapGraph } from "@/lib/data";

export interface CameraTarget {
  id: string;
  /** bump this to re-trigger a focus even if id is unchanged. */
  nonce: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Cam {
  x: number;
  y: number;
  z: number;
}

function edgeAnchors(s: Box, t: Box) {
  const scx = s.x + s.w / 2,
    tcx = t.x + t.w / 2;
  const sameRow = Math.abs(s.y + s.h / 2 - (t.y + t.h / 2)) < 60;
  if (sameRow) {
    const sx = s.x < t.x ? s.x + s.w : s.x,
      ex = s.x < t.x ? t.x : t.x + t.w;
    const sy = s.y + s.h / 2,
      ey = t.y + t.h / 2,
      dx = (ex - sx) * 0.5;
    return {
      sx,
      sy,
      ex,
      ey,
      c1x: sx + dx,
      c1y: sy,
      c2x: ex - dx,
      c2y: ey,
      mx: (sx + ex) / 2,
      my: (sy + ey) / 2,
    };
  }
  const sx = scx,
    sy = s.y + s.h,
    ex = tcx,
    ey = t.y,
    dy = (ey - sy) * 0.55;
  return {
    sx,
    sy,
    ex,
    ey,
    c1x: sx,
    c1y: sy + dy,
    c2x: ex,
    c2y: ey - dy,
    mx: (sx + ex) / 2,
    my: (sy + ey) / 2,
  };
}

export function Canvas({
  data,
  selectedId,
  onSelect,
  cameraTarget,
}: {
  data: CodeMapGraph;
  selectedId: string | null;
  onSelect: (id: string) => void;
  cameraTarget: CameraTarget | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [boxes, setBoxes] = useState<Record<string, Box>>({});
  const [cam, setCam] = useState<Cam>({ x: 0, y: 0, z: 0.82 });
  const [smooth, setSmooth] = useState(false);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const measure = useCallback(() => {
    const b: Record<string, Box> = {};
    for (const node of data.nodes) {
      const el = nodeRefs.current[node.id];
      if (el) b[node.id] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    }
    setBoxes(b);
  }, [data.nodes]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  useEffect(() => {
    const raf = requestAnimationFrame(measure);
    const t1 = setTimeout(measure, 60);
    const t2 = setTimeout(measure, 300);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [selectedId, measure]);

  useEffect(() => {
    const r = () => measure();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [measure]);

  // initial fit
  const fit = useCallback(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const pad = 90;
    const zw = (wrap.clientWidth - pad * 2) / data.stage.w;
    const zh = (wrap.clientHeight - pad * 2) / data.stage.h;
    const z = Math.min(0.95, Math.max(0.5, Math.min(zw, zh)));
    const x = (wrap.clientWidth - data.stage.w * z) / 2;
    const y = (wrap.clientHeight - data.stage.h * z) / 2 - 6;
    setSmooth(true);
    setCam({ x, y, z });
  }, [data.stage]);

  useEffect(() => {
    const t = setTimeout(fit, 80);
    return () => clearTimeout(t);
  }, [fit]);

  // programmatic focus on a node (click + voice navigate)
  useEffect(() => {
    if (!cameraTarget || !cameraTarget.id) return;
    const b = boxes[cameraTarget.id];
    const wrap = wrapRef.current;
    if (!b || !wrap) return;
    const z = 1.0;
    const cx = b.x + b.w / 2,
      cy = b.y + b.h / 2;
    const x = wrap.clientWidth / 2 - cx * z;
    const y = wrap.clientHeight / 2 - cy * z - 10;
    setSmooth(true);
    setCam({ x, y, z });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget?.nonce]);

  const zoomBy = (f: number) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    setSmooth(true);
    setCam((c) => {
      const z = Math.min(1.8, Math.max(0.4, c.z * f));
      const cx = wrap.clientWidth / 2,
        cy = wrap.clientHeight / 2;
      const x = cx - (cx - c.x) * (z / c.z);
      const y = cy - (cy - c.y) * (z / c.z);
      return { x, y, z };
    });
  };

  const onWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) {
      // pan
      setSmooth(false);
      setCam((c) => ({ ...c, x: c.x - e.deltaX, y: c.y - e.deltaY }));
      return;
    }
    e.preventDefault();
    setSmooth(false);
    const rect = wrapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left,
      my = e.clientY - rect.top;
    setCam((c) => {
      const z = Math.min(1.8, Math.max(0.4, c.z * (1 - e.deltaY * 0.0016)));
      return { x: mx - (mx - c.x) * (z / c.z), y: my - (my - c.y) * (z / c.z), z };
    });
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".node")) return;
    setSmooth(false);
    drag.current = { px: e.clientX, py: e.clientY, ox: cam.x, oy: cam.y };
    wrapRef.current?.classList.add("grabbing");
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setCam((c) => ({
      ...c,
      x: drag.current!.ox + (e.clientX - drag.current!.px),
      y: drag.current!.oy + (e.clientY - drag.current!.py),
    }));
  };
  const onUp = () => {
    drag.current = null;
    wrapRef.current?.classList.remove("grabbing");
  };

  const connected = new Set<string>();
  data.edges.forEach((e) => {
    if (e.from === selectedId || e.to === selectedId) {
      connected.add(e.from);
      connected.add(e.to);
    }
  });

  return (
    <div
      className="canvas-wrap"
      ref={wrapRef}
      onWheel={onWheel}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <div className="grid-bg" style={{ transform: `translate(${cam.x % 26}px, ${cam.y % 26}px)` }} />

      <div className="canvas-hint">
        <Icon n="info" style={{ width: 14, height: 14 }} />
        <span>
          Click any node to explore · or <b>hold ⌘ + scroll</b> to zoom
        </span>
      </div>

      <div className="legend">
        <div className="legend-h">Layers</div>
        {Object.entries(data.kinds).map(([k, v]) => (
          <div className="legend-row" key={k}>
            <span className="legend-sw" style={{ background: v.sw }} />
            {v.label}
          </div>
        ))}
      </div>

      <div
        className="stage"
        style={{
          transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`,
          transition: smooth ? "transform .55s cubic-bezier(.4,0,.15,1)" : "none",
        }}
      >
        <div className="stage-inner" style={{ width: data.stage.w, height: data.stage.h }}>
          <svg className="edges" width={data.stage.w} height={data.stage.h}>
            {data.edges.map((e, i) => {
              const s = boxes[e.from],
                t = boxes[e.to];
              if (!s || !t) return null;
              const a = edgeAnchors(s, t);
              const d = `M${a.sx},${a.sy} C${a.c1x},${a.c1y} ${a.c2x},${a.c2y} ${a.ex},${a.ey}`;
              const hot = e.from === selectedId || e.to === selectedId;
              const lw = e.label.length * 5.6 + 10;
              return (
                <g key={i}>
                  <path className={"edge-path" + (hot ? " hot" : "")} d={d} />
                  {hot && <path className="edge-flow" d={d} />}
                  <rect
                    className="edge-label-bg"
                    x={a.mx - lw / 2}
                    y={a.my - 8}
                    width={lw}
                    height={16}
                    rx="4"
                    opacity="0.92"
                  />
                  <text className={"edge-label" + (hot ? " hot" : "")} x={a.mx} y={a.my + 3.5} textAnchor="middle">
                    {e.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {data.nodes.map((node) => {
            const sel = node.id === selectedId;
            const dim = !!selectedId && !sel && !connected.has(node.id);
            return (
              <div
                key={node.id}
                ref={(el) => {
                  nodeRefs.current[node.id] = el;
                }}
                className={"node" + (sel ? " sel" : "") + (dim ? " dim" : "")}
                style={{ left: node.x, top: node.y, width: node.w }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(node.id);
                }}
              >
                <span className="node-status" />
                <div className="node-head">
                  <div className="node-ico">
                    <Icon n={node.icon} />
                  </div>
                  <div className="node-txt">
                    <div className="node-kind">{data.kinds[node.kind].label}</div>
                    <div className="node-title">{node.label}</div>
                    <div className="node-sub">{node.sub}</div>
                  </div>
                </div>
                {sel && node.children && (
                  <div className="node-children">
                    {node.children.map((c, i) => (
                      <div className="child" key={i}>
                        <Icon
                          n={c.type === "table" ? "table" : c.type === "bucket" ? "bucket" : "file"}
                          className="child-ico"
                        />
                        <span className="mono">{c.name}</span>
                        <span className="child-tag">{c.meta}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="cam">
        <button onClick={() => zoomBy(1.2)} title="Zoom in">
          <Icon n="plus" />
        </button>
        <div className="cam zlevel" style={{ display: "grid", placeItems: "center" }}>
          {Math.round(cam.z * 100)}
        </div>
        <button onClick={() => zoomBy(1 / 1.2)} title="Zoom out">
          <Icon n="minus" />
        </button>
        <button onClick={fit} title="Fit to screen">
          <Icon n="fit" />
        </button>
      </div>
    </div>
  );
}

export default Canvas;
