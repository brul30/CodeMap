"use client";
/* ============================================================
   CodeMap — agent log terminal (ported from componentsUI/assets/components.jsx)
   ============================================================ */
import { useEffect, useRef } from "react";
import { Icon } from "./Icon";
import type { LogLine } from "@/lib/data";

export function Terminal({
  logs,
  open,
  onToggle,
  ready,
  nodeCount = 7,
}: {
  logs: LogLine[];
  open: boolean;
  onToggle: () => void;
  ready: boolean;
  nodeCount?: number;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [logs, open]);

  return (
    <div className={"term " + (open ? "open" : "closed")}>
      <div className="term-bar" onClick={onToggle}>
        <div className="term-lights">
          <i />
          <i />
          <i />
        </div>
        <span className="term-title">
          agent · <b>analysis.log</b>
        </span>
        {!ready ? <span className="term-spin" /> : null}
        <div className="term-meta">
          <span className="term-stat">
            {ready ? (
              <span>
                <b>ready</b> · {nodeCount} nodes
              </span>
            ) : (
              "running…"
            )}
          </span>
          <Icon n="caret" className="term-chev" />
        </div>
      </div>
      <div className="term-body" ref={bodyRef}>
        {logs.map((l, i) => (
          <div className={"log" + (i === logs.length - 1 ? " fresh" : "")} key={i}>
            <span className="log-t">{l.t}</span>
            <span className={"log-tag " + l.tag}>[{l.tag.toUpperCase()}]</span>
            <span className="log-msg" dangerouslySetInnerHTML={{ __html: l.msg }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default Terminal;
