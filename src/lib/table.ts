export interface TableColumn<T> {
  key: keyof T | ((item: T) => string | number);
  header: string;
  width?: number;
}

// Rough estimation of display width accounting for full-width CJK characters
function stringWidth(str: string): number {
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    // CJK Unified Ideographs & fullwidth punctuation
    if (
      (code >= 0x4e00 && code <= 0x9fff) ||
      (code >= 0x3000 && code <= 0x303f) ||
      (code >= 0xff00 && code <= 0xff60)
    ) {
      width += 2;
    } else {
      width += 1;
    }
  }
  return width;
}

function pad(str: string, targetWidth: number): string {
  const currentWidth = stringWidth(str);
  if (currentWidth >= targetWidth) {
    return str;
  }
  return str + " ".repeat(targetWidth - currentWidth);
}

export function renderTable<T>(items: T[], columns: TableColumn<T>[]): string {
  if (items.length === 0) {
    return "";
  }

  // Calculate actual column widths dynamically
  const colWidths = columns.map((col) => {
    let max = stringWidth(col.header);
    for (const item of items) {
      const val =
        typeof col.key === "function" ? col.key(item) : (item[col.key] as unknown);
      const str = String(val ?? "");
      max = Math.max(max, stringWidth(str));
    }
    return Math.max(max, col.width ?? 6);
  });

  const headerLine = columns
    .map((col, idx) => pad(col.header, colWidths[idx]!))
    .join(" | ");

  const separator = colWidths
    .map((w) => "-".repeat(w))
    .join("-+-");

  const rows = items.map((item) => {
    return columns
      .map((col, idx) => {
        const val =
          typeof col.key === "function"
            ? col.key(item)
            : (item[col.key] as unknown);
        const str = String(val ?? "");
        return pad(str, colWidths[idx]!);
      })
      .join(" | ");
  });

  return [headerLine, separator, ...rows].join("\n");
}
