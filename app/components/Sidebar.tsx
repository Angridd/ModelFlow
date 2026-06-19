"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const navItems = [
  {
    href: "/projects",
    label: "Projets",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <rect x="0.5" y="0.5" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.8" />
        <rect x="8.5" y="0.5" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="0.5" y="8.5" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="8.5" y="8.5" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.8" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <>
      <button
        className="sidebar-hamburger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Ouvrir le menu"
      >
        {open ? "✕" : "☰"}
      </button>

      {open && (
        <div className="sidebar-overlay" onClick={() => setOpen(false)} />
      )}

      <nav
        className={`sidebar${open ? " sidebar-open" : ""}`}
        aria-label="Navigation principale"
      >
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">MF</div>
          <span className="sidebar-logo-text">ModelFlow</span>
        </div>

        <div className="sidebar-nav">
          <span className="sidebar-section-label">Portefeuille</span>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${isActive(item.href) ? " active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">ModelFlow v0.1.0</div>
      </nav>
    </>
  );
}
