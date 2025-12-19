import chalk from "chalk";
import stringWidth from "string-width";

const padEndDisplay = (s: string, width: number): string => {
    let out = s;
    while (stringWidth(out) < width) {
        out += " ";
    }
    return out;
};

const truncateDisplay = (s: string, width: number): string => {
    if (stringWidth(s) <= width) return s;
    if (width <= 0) return "";
    const ellipsis = width > 3 ? "..." : "";
    const target = width - stringWidth(ellipsis);
    if (target <= 0) return ellipsis.slice(0, width);
    let out = "";
    for (const ch of s) {
        const next = out + ch;
        if (stringWidth(next) > target) break;
        out = next;
    }
    return out + ellipsis;
};

export type ConsoleTablerCell = string | number | boolean | null | undefined;
export type ConsoleTablerRow = Record<string, ConsoleTablerCell>;
export type ConsoleTablerTable = ConsoleTablerRow[];

export interface ConsoleTablerOptions {
    columns?: string[];
    headerNames?: Record<string, string>;
    colorValues?: boolean; // default true (can be used to disable value coloring even if color is provided)
    padLastColumn?: boolean; // default false to mirror readCsv.ts style
    color?: string; // hex like #FFBB30 for value cells
    borderColor?: string; // hex color for pipes and separators
    headerColor?: string; // hex color for header text; falls back to color if not set
}

const toStr = (v: ConsoleTablerCell): string => {
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "true" : "false";
    return String(v);
};

const computeColumns = (
    rows: ConsoleTablerTable,
    explicit?: string[]
): string[] => {
    if (explicit && explicit.length) return [...explicit];
    const cols: string[] = [];
    for (const r of rows) {
        for (const k of Object.keys(r)) {
            if (!cols.includes(k)) cols.push(k);
        }
    }
    return cols;
};

export const buildConsoleTableLines = (
    rows: ConsoleTablerTable,
    options: ConsoleTablerOptions = {}
): string[] => {
    const {
        columns: explicitCols,
        headerNames = {},
        colorValues = true,
        padLastColumn = false,
        color,
        borderColor,
        headerColor,
    } = options;

    const cols = computeColumns(rows, explicitCols);
    if (cols.length === 0) return [];

    const headerLabels = cols.map((c) => headerNames[c] ?? c);
    const widths = cols.map((c, idx) => {
        const isLast = idx === cols.length - 1;
        // For last column with padLastColumn=false, we still need width for header and separator
        const maxValLen = Math.max(
            0,
            ...rows.map((r) => stringWidth(toStr(r[c])))
        );
        const headerLen = stringWidth(headerNames[c] ?? c);
        return Math.max(
            headerLen,
            isLast && !padLastColumn ? headerLen : maxValLen
        );
    });

    const pad = (s: string, w: number) => padEndDisplay(s, w);
    const lines: string[] = [];

    const isHex = (s?: string): s is string =>
        !!s && /^#[0-9a-fA-F]{6}$/.test(s);
    const valueColorHex = isHex(color) ? color : undefined;
    const headerColorHex = isHex(headerColor)
        ? headerColor
        : isHex(color)
        ? color
        : undefined;
    const borderColorHex = isHex(borderColor) ? borderColor : undefined;
    const colorize = (txt: string, hex?: string) =>
        hex ? chalk.hex(hex)(txt) : txt;

    const pipe = colorize("|", borderColorHex);
    const delim = ` ${pipe} `;

    // Header
    const headerParts = headerLabels.map((h, i) => {
        const isLast = i === cols.length - 1;
        const base = isLast && !padLastColumn ? h : pad(h, widths[i]);
        return colorize(base, headerColorHex);
    });
    lines.push(`${pipe} ${headerParts.join(delim)} ${pipe}`);

    // Separator
    const sepParts = cols.map((_, i) => {
        const isLast = i === cols.length - 1;
        const w =
            isLast && !padLastColumn
                ? Math.max(widths[i], stringWidth(headerLabels[i]))
                : widths[i];
        return colorize("-".repeat(Math.max(1, w)), borderColorHex);
    });
    lines.push(`${pipe} ${sepParts.join(delim)} ${pipe}`);

    // Rows
    for (const r of rows) {
        const parts = cols.map((c, i) => {
            const isLast = i === cols.length - 1;
            const raw = toStr(r[c]);
            const val = isLast && !padLastColumn ? raw : pad(raw, widths[i]);
            return colorValues && valueColorHex
                ? colorize(val, valueColorHex)
                : val;
        });
        lines.push(`${pipe} ${parts.join(delim)} ${pipe}`);
    }

    return lines;
};

export const printConsoleTable = (
    rows: ConsoleTablerTable,
    options: ConsoleTablerOptions = {}
) => {
    const lines = buildConsoleTableLines(rows, options);
    for (const ln of lines) console.log(ln);
};

// Fixed-width streaming table printer
export interface FixedColumnDef {
    header: string; // header name to display
    width: number; // fixed column width
}

export class ConsoleTablePrinter {
    private cols: FixedColumnDef[];
    private padEnd(s: string, width: number): string {
        return padEndDisplay(s, width);
    }

    private formatCell(value: ConsoleTablerCell, width: number): string {
        const truncated = truncateDisplay(toStr(value), width);
        return this.padEnd(truncated, width);
    }
    static create(columns: FixedColumnDef[]) {
        return new ConsoleTablePrinter(columns);
    }
    constructor(columns: FixedColumnDef[]) {
        if (!columns || columns.length === 0) {
            throw new Error("ConsoleTablePrinter requires at least one column");
        }
        for (const c of columns) {
            if (
                !c ||
                typeof c.header !== "string" ||
                typeof c.width !== "number"
            ) {
                throw new Error(
                    "Each column must have a header (string) and width (number)"
                );
            }
            if (c.width <= 0) {
                throw new Error("Column width must be greater than 0");
            }
        }
        this.cols = columns;
    }

    printHeader() {
        const headerCells = this.cols.map((c) =>
            this.padEnd(c.header, c.width)
        );
        const sepCells = this.cols.map((c) => "-".repeat(c.width));
        console.log(`| ${headerCells.join(" | ")} |`);
        console.log(`| ${sepCells.join(" | ")} |`);
        return this;
    }

    push(cells: ConsoleTablerCell[]) {
        const vals = this.cols.map((c, i) =>
            this.formatCell(cells[i], c.width)
        );
        console.log(`| ${vals.join(" | ")} |`);
        return this;
    }
    pushMany(rows: Array<ConsoleTablerCell[] | ConsoleTablerRow>) {
        for (const r of rows) {
            if (Array.isArray(r)) {
                const vals = this.cols.map((c, i) =>
                    this.formatCell(r[i], c.width)
                );
                console.log(`| ${vals.join(" | ")} |`);
            } else {
                const vals = this.cols.map((c) =>
                    this.formatCell(r[c.header], c.width)
                );
                console.log(`| ${vals.join(" | ")} |`);
            }
        }
        return this;
    }
}
