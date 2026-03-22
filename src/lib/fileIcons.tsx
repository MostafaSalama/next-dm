import type { CategoryFilter } from "../stores/tasksStore";
import { getFileCategory } from "../stores/tasksStore";

const ICON_SIZE = 20;

function SvgIcon({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <svg
      width={ICON_SIZE}
      height={ICON_SIZE}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}

function VideoIcon() {
  return (
    <SvgIcon color="var(--color-downloading)">
      <polygon points="5 3 19 12 5 21 5 3" fill="var(--color-downloading)" fillOpacity={0.15} />
    </SvgIcon>
  );
}

function AudioIcon() {
  return (
    <SvgIcon color="#E879F9">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" fill="#E879F9" fillOpacity={0.15} />
      <circle cx="18" cy="16" r="3" fill="#E879F9" fillOpacity={0.15} />
    </SvgIcon>
  );
}

function DocumentIcon() {
  return (
    <SvgIcon color="#60A5FA">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="#60A5FA" fillOpacity={0.1} />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </SvgIcon>
  );
}

function ArchiveIcon() {
  return (
    <SvgIcon color="#FBBF24">
      <path d="M21 8v13H3V8" fill="#FBBF24" fillOpacity={0.1} />
      <rect x="1" y="3" width="22" height="5" rx="1" fill="#FBBF24" fillOpacity={0.1} />
      <line x1="10" y1="12" x2="14" y2="12" />
    </SvgIcon>
  );
}

function ImageIcon() {
  return (
    <SvgIcon color="#34D399">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="#34D399" fillOpacity={0.1} />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </SvgIcon>
  );
}

function ExecutableIcon() {
  return (
    <SvgIcon color="#F87171">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" fill="#F87171" fillOpacity={0.1} />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <polyline points="7 10 10 13 7 16" />
    </SvgIcon>
  );
}

function GenericIcon() {
  return (
    <SvgIcon color="var(--on-surface-variant)">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="var(--on-surface-variant)" fillOpacity={0.08} />
      <polyline points="14 2 14 8 20 8" />
    </SvgIcon>
  );
}

const ICON_MAP: Record<CategoryFilter, () => React.JSX.Element> = {
  all: GenericIcon,
  video: VideoIcon,
  audio: AudioIcon,
  document: DocumentIcon,
  archive: ArchiveIcon,
  image: ImageIcon,
  executable: ExecutableIcon,
  other: GenericIcon,
};

export function FileIcon({ filename }: { filename: string }) {
  const category = getFileCategory(filename);
  const Icon = ICON_MAP[category];
  return <Icon />;
}
