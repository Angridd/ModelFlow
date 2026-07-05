"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  isActive: (pathname: string) => boolean;
};

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Dashboard",
    // Vue analyse : KPIs agrégés + graphiques du portefeuille calibré.
    isActive: (pathname) => pathname === "/",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <rect x="0.5" y="8" width="3.5" height="6.5" rx="1" fill="currentColor" opacity="0.8" />
        <rect x="5.75" y="4" width="3.5" height="10.5" rx="1" fill="currentColor" />
        <rect x="11" y="0.5" width="3.5" height="14" rx="1" fill="currentColor" opacity="0.8" />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "Projets",
    // Vue liste : accès rapide fiche par fiche (le formulaire "nouveau" a son propre onglet).
    isActive: (pathname) =>
      pathname === "/projects" ||
      (pathname.startsWith("/projects/") && pathname !== "/projects/new"),
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <rect x="0.5" y="0.5" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.8" />
        <rect x="8.5" y="0.5" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="0.5" y="8.5" width="6" height="6" rx="1.5" fill="currentColor" />
        <rect x="8.5" y="8.5" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.8" />
      </svg>
    ),
  },
  {
    href: "/projects/new",
    label: "+ Nouveau projet",
    isActive: (pathname) => pathname === "/projects/new",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
        <rect x="6.25" y="1" width="2.5" height="13" rx="1.25" fill="currentColor" />
        <rect x="1" y="6.25" width="13" height="2.5" rx="1.25" fill="currentColor" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
        <Link href="/" className="sidebar-logo" onClick={() => setOpen(false)}>
          <div className="sidebar-logo-mark">MF</div>
          <span className="sidebar-logo-text">ModelFlow</span>
        </Link>

        <div className="sidebar-nav">
          <span className="sidebar-section-label">Portefeuille</span>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-item${item.isActive(pathname) ? " active" : ""}`}
              aria-current={item.isActive(pathname) ? "page" : undefined}
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
