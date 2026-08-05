import type { HTMLAttributes, ReactNode } from "react";

import { ArchiveSprite, PixelIcon, type PixelIconName } from "./pixel-icons";

type WindowTitleBarProps = {
  title: string;
};

export function WindowTitleBar({ title }: WindowTitleBarProps) {
  return (
    <div className="window-titlebar">
      <span className="window-titlebar__label">
        <PixelIcon name="computer" size={16} />
        <span>{title}</span>
      </span>
      <span aria-hidden="true" className="window-titlebar__controls">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}

type PanelProps = HTMLAttributes<HTMLElement> & {
  title: string;
  icon: PixelIconName;
  children: ReactNode;
  headingId?: string;
  tone?: "default" | "info" | "warning";
};

export function Panel({
  title,
  icon,
  children,
  headingId,
  tone = "default",
  className,
  ...props
}: PanelProps) {
  const classes = ["panel", `panel--${tone}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classes} aria-labelledby={headingId} {...props}>
      <div className="panel__titlebar">
        <PixelIcon name={icon} size={20} />
        <h2 id={headingId}>{title}</h2>
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

type IconLabelProps = {
  icon: PixelIconName;
  children: ReactNode;
  className?: string;
};

export function IconLabel({ icon, children, className }: IconLabelProps) {
  return (
    <span className={["icon-label", className].filter(Boolean).join(" ")}>
      <PixelIcon name={icon} size={20} />
      <span>{children}</span>
    </span>
  );
}

type StatusChipProps = {
  icon: PixelIconName;
  children: ReactNode;
  tone?: "confirmed" | "unknown" | "held" | "ended" | "neutral";
};

export function StatusChip({
  icon,
  children,
  tone = "neutral",
}: StatusChipProps) {
  return (
    <span className={`status-chip status-chip--${tone}`}>
      <PixelIcon name={icon} size={16} />
      <span>{children}</span>
    </span>
  );
}

export function PixelDivider() {
  return <div aria-hidden="true" className="pixel-divider" />;
}

type EmptyStateProps = {
  title: string;
  children: ReactNode;
};

export function EmptyState({ title, children }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <PixelIcon name="archive" size={32} />
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </div>
  );
}

export function ArchiveDecoration() {
  return (
    <div aria-hidden="true" className="archive-decoration">
      <ArchiveSprite />
      <span className="archive-decoration__label">SCENARIO FILES</span>
    </div>
  );
}

export function ProjectBadge() {
  return (
    <span aria-label="TRPG Archive Fixture Index" className="project-badge">
      <span>TRPG</span>
      <strong>ARCHIVE</strong>
      <small>FIXTURE INDEX</small>
    </span>
  );
}
