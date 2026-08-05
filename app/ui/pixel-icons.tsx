export const PIXEL_ICON_MEANINGS = {
  archive: "archive and stored records",
  book: "rulebook requirement",
  check: "confirmed publication state",
  clock: "play-time information",
  computer: "search application",
  document: "scenario record",
  external: "external product page",
  filter: "search filters",
  info: "information",
  people: "player-count information",
  random: "seeded random order",
  reset: "reset search conditions",
  search: "run search",
  sort: "result order",
  tag: "scenario tags",
  unknown: "explicitly unknown value",
  warning: "publication safety boundary",
} as const;

export type PixelIconName = keyof typeof PIXEL_ICON_MEANINGS;

type PixelIconProps = {
  name: PixelIconName;
  size?: 16 | 20 | 24 | 32;
  className?: string;
};

function IconPixels({ name }: { name: PixelIconName }) {
  switch (name) {
    case "archive":
      return (
        <>
          <path d="M3 5h7l2 2h9v3H3z" />
          <path d="M2 10h20v10H2z" />
          <path d="M5 13h14v2H5zm3 4h8v2H8z" className="pixel-icon__cut" />
        </>
      );
    case "book":
      return (
        <>
          <path d="M3 3h8v17H3zm10 0h8v17h-8z" />
          <path d="M6 6h3v2H6zm9 0h3v2h-3zM11 4h2v18h-2z" className="pixel-icon__cut" />
        </>
      );
    case "check":
      return <path d="M3 12h4v4h4v-4h3V9h3V6h4v6h-3v3h-3v3h-3v3H8v-3H5v-3H3z" />;
    case "clock":
      return (
        <>
          <path d="M8 2h8v2h4v4h2v8h-2v4h-4v2H8v-2H4v-4H2V8h2V4h4z" />
          <path d="M10 6h4v6h4v3h-7V9h-1z" className="pixel-icon__cut" />
        </>
      );
    case "computer":
      return (
        <>
          <path d="M2 3h20v15H2zm6 17h8v2H8z" />
          <path d="M5 6h14v9H5zm5 12h4v2h-4z" className="pixel-icon__cut" />
        </>
      );
    case "document":
      return (
        <>
          <path d="M4 2h11l5 5v15H4z" />
          <path d="M14 3v5h5M7 11h10v2H7zm0 4h10v2H7zm0 4h7v2H7z" className="pixel-icon__cut" />
        </>
      );
    case "external":
      return (
        <>
          <path d="M3 5h8v3H6v10h10v-5h3v8H3z" />
          <path d="M12 3h9v9h-3V8l-7 7-2-2 7-7h-4z" />
        </>
      );
    case "filter":
      return <path d="M2 3h20v4h-3l-6 7v7H9v-7L3 7H2zm5 4 4 5 4-5z" />;
    case "info":
      return (
        <>
          <path d="M8 2h8v2h4v4h2v8h-2v4h-4v2H8v-2H4v-4H2V8h2V4h4z" />
          <path d="M10 6h4v4h-4zm0 6h4v6h-4z" className="pixel-icon__cut" />
        </>
      );
    case "people":
      return (
        <>
          <path d="M4 3h6v2h2v6h-2v2H4v-2H2V5h2zm10 2h5v2h2v5h-2v2h-5v-2h-2V7h2zM2 16h10v6H2zm11 1h9v5h-9z" />
          <path d="M5 6h4v4H5zm10 2h3v3h-3z" className="pixel-icon__cut" />
        </>
      );
    case "random":
      return <path d="M2 5h5l4 5-2 3-4-5H2zm14 0h6v6h-3V9h-3l-9 10H2v-3h3l9-11h2zm-2 11h5v-2l3 3-3 4v-2h-7z" />;
    case "reset":
      return <path d="M8 3h10v3h3v3h2l-4 4-4-4h2V7H8v2H5v8h3v3h9v-4h4v5h-3v2H8v-2H4v-4H2V9h2V6h4z" />;
    case "search":
      return (
        <>
          <path d="M3 3h12v2h3v3h2v7h-2v3h-3v2H3zM16 16h3v3h3v3h-4v-3h-3z" />
          <path d="M6 6h8v2h2v6h-2v2H6z" className="pixel-icon__cut" />
        </>
      );
    case "sort":
      return <path d="M4 3h3v14h3l-5 5-5-5h4zm9 2h9v3h-9zm0 6h7v3h-7zm0 6h5v3h-5z" />;
    case "tag":
      return (
        <>
          <path d="M2 3h11l9 9-10 10-10-10z" />
          <path d="M6 7h4v4H6z" className="pixel-icon__cut" />
        </>
      );
    case "unknown":
      return (
        <>
          <path d="M8 2h8v2h4v4h2v8h-2v4h-4v2H8v-2H4v-4H2V8h2V4h4z" />
          <path d="M9 6h6v2h2v5h-2v2h-2v2H9v-4h4v-2h1V9h-5zm0 12h4v3H9z" className="pixel-icon__cut" />
        </>
      );
    case "warning":
      return (
        <>
          <path d="M10 2h4v4h2v4h2v4h2v4h2v4H2v-4h2v-4h2v-4h2V6h2z" />
          <path d="M10 8h4v7h-4zm0 9h4v3h-4z" className="pixel-icon__cut" />
        </>
      );
  }
}

export function PixelIcon({ name, size = 24, className }: PixelIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={["pixel-icon", className].filter(Boolean).join(" ")}
      focusable="false"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <IconPixels name={name} />
    </svg>
  );
}

export function ArchiveSprite() {
  return (
    <svg
      aria-hidden="true"
      className="archive-sprite"
      focusable="false"
      height="72"
      viewBox="0 0 96 72"
      width="96"
    >
      <path className="archive-sprite__dark" d="M8 8h56v8h8v48H8z" />
      <path className="archive-sprite__light" d="M16 16h48v16H16zm0 24h16v16H16zm24 0h24v16H40z" />
      <path className="archive-sprite__accent" d="M72 24h16v40H64v-8h8zm-48-8h24v8H24z" />
      <path className="archive-sprite__dark" d="M76 32h8v8h-8zm0 16h8v8h-8zM20 44h8v8h-8zm24 0h16v8H44z" />
    </svg>
  );
}
