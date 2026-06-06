/* ============================================================
   CodeMap — top header (ported from componentsUI/assets/components.jsx)
   ============================================================ */
import Link from "next/link";
import { Icon } from "./Icon";

export interface RepoMeta {
  owner: string;
  name: string;
  branch: string;
  commit: string;
}

export function Header({ repo }: { repo: RepoMeta }) {
  return (
    <header className="hdr">
      {/* Logo → home: start over and map another repo. */}
      <Link href="/" className="brand" title="Map another repo" style={{ textDecoration: "none", color: "inherit" }}>
        <div className="brand-mark">
          <Icon n="logo" />
        </div>
        <div>
          <div className="brand-name">
            Code<b>Map</b>
          </div>
          <div className="brand-tag">tour guide</div>
        </div>
      </Link>

      <div className="hdr-divider" />

      <button className="repo">
        <span className="repo-av">
          <Icon n="github" />
        </span>
        <span className="repo-meta">
          <span className="repo-name">
            {repo.owner}
            <span>/</span>
            {repo.name}
          </span>
          <span className="repo-sync">
            <i className="dot-live" />
            synced · {repo.branch} · {repo.commit}
          </span>
        </span>
        <Icon n="caret" className="repo-caret" />
      </button>

      <label className="search">
        <Icon n="search" />
        <input placeholder="Search nodes, files, or ask the codebase…" />
        <span className="kbd">⌘K</span>
      </label>

      <div className="hdr-actions">
        <button className="icon-btn">
          <Icon n="sitemap" />
        </button>
        <button className="icon-btn">
          <Icon n="bell" />
          <span className="badge" />
        </button>
        <button className="icon-btn">
          <Icon n="settings" />
        </button>
        <button className="avatar">AR</button>
      </div>
    </header>
  );
}

export default Header;
