export interface IndexConfig {
  start: number;
  step: number;
  padding: number;
}

export interface NamingContext {
  original: string;
  ext: string;
  index: string;
  date: string;
  tag: string;
  queue: string;
}

const DEFAULT_INDEX_CONFIG: IndexConfig = { start: 1, step: 1, padding: 2 };

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(dot) : "";
}

function getBaseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

function padIndex(n: number, padding: number): string {
  return String(n).padStart(padding, "0");
}

export function resolvePattern(pattern: string, context: NamingContext): string {
  return pattern
    .replace(/\{original\}/g, context.original)
    .replace(/\{ext\}/g, context.ext)
    .replace(/\{index\}/g, context.index)
    .replace(/\{date\}/g, context.date)
    .replace(/\{tag\}/g, context.tag)
    .replace(/\{queue\}/g, context.queue);
}

export interface FileEntry {
  filename: string;
  tags?: string[];
}

export function resolveAllFiles(
  pattern: string,
  files: FileEntry[],
  queueName: string,
  indexConfig: IndexConfig = DEFAULT_INDEX_CONFIG,
): string[] {
  const today = new Date().toISOString().slice(0, 10);

  return files.map((file, i) => {
    const idx = indexConfig.start + i * indexConfig.step;
    const context: NamingContext = {
      original: getBaseName(file.filename),
      ext: getExtension(file.filename),
      index: padIndex(idx, indexConfig.padding),
      date: today,
      tag: file.tags?.[0] ?? "",
      queue: queueName,
    };
    return resolvePattern(pattern, context);
  });
}

export const AVAILABLE_TOKENS = [
  { token: "{original}", label: "Original filename" },
  { token: "{ext}", label: "File extension" },
  { token: "{index}", label: "Sequential index" },
  { token: "{date}", label: "Current date" },
  { token: "{tag}", label: "First tag" },
  { token: "{queue}", label: "Queue name" },
];
