import { approach } from "@/lib/version2-content";

/**
 * ASCII artwork for the glyph world, composed on a character grid so every
 * diagram is exact and identical on server and client. Labels come from the
 * content file wherever they exist there.
 */

type Grid = string[][];

function grid(width: number, height: number): Grid {
  return Array.from({ length: height }, () => Array<string>(width).fill(" "));
}

function put(g: Grid, row: number, col: number, text: string) {
  const line = g[row];
  if (!line) return;
  for (let i = 0; i < text.length; i++) {
    if (col + i >= 0 && col + i < line.length) line[col + i] = text[i];
  }
}

function render(g: Grid) {
  return g.map((row) => row.join("").replace(/\s+$/, "")).join("\n");
}

/** A horizontal run that starts as noise and settles into a clean line. */
function stream(noise: string, length: number, clean = "-") {
  return (noise + clean.repeat(Math.max(0, length - noise.length))).slice(0, length);
}

/** Round "system" ring, 21 wide x 8 tall, with up to three centred lines inside. */
function ring(g: Grid, row: number, col: number, lines: string[]) {
  put(g, row, col, "    .-'''''''''''-.");
  put(g, row + 1, col, "  .'               '.");
  put(g, row + 2, col, " /                   \\");
  put(g, row + 3, col, "|                     |");
  put(g, row + 4, col, "|                     |");
  put(g, row + 5, col, " \\                   /");
  put(g, row + 6, col, "  '.               .'");
  put(g, row + 7, col, "    '-.............-'");
  lines.forEach((text, i) => put(g, row + 2 + i, col + 11 - Math.floor(text.length / 2), text));
}

/* -------------------------------------------------------------------------- */
/* Hero: Data, Models and Systems stream (noise -> order) into one system.    */
/* -------------------------------------------------------------------------- */
function heroDiagram() {
  const g = grid(60, 14);
  const ringCol = 37;
  put(g, 0, 0, "FROM COMPLEXITY");
  ring(g, 2, ringCol, ["ONE SYSTEM", "", "Connected", "intelligence"]);

  put(g, 3, 0, "[01] Data");
  put(g, 3, 14, stream("%#&?;:=", 15));
  put(g, 3, 29, "..__");
  put(g, 4, 32, "``-.");

  put(g, 5, 0, "[02] Models");
  put(g, 5, 14, stream("{$!^*=:", 22));
  put(g, 5, 36, ">");

  put(g, 6, 32, "_.-'");
  put(g, 7, 0, "[03] Systems");
  put(g, 7, 14, stream("~/[]^;:=", 15));
  put(g, 7, 29, "''''");

  put(g, 10, 48, "|");
  put(g, 11, 48, "v");
  put(g, 12, 39, "REAL CAPABILITY ->");
  return render(g);
}

/* -------------------------------------------------------------------------- */
/* Intro: a double helix with base pairs (life sciences).                     */
/* -------------------------------------------------------------------------- */
function helix(rows = 20, width = 27) {
  const g = grid(width, rows);
  const center = (width - 1) / 2;
  const amp = (width - 3) / 2;
  const pairs = ["AT", "CG", "TA", "GC"];
  for (let r = 0; r < rows; r++) {
    const phase = r * 0.52;
    const a = Math.round(center + Math.sin(phase) * amp);
    const b = Math.round(center - Math.sin(phase) * amp);
    const front = Math.cos(phase) >= 0;
    const left = Math.min(a, b);
    const right = Math.max(a, b);
    if (right - left > 3) {
      const pair = pairs[r % pairs.length];
      for (let c = left + 2; c <= right - 2; c++) g[r][c] = "-";
      g[r][left + 1] = pair[0];
      g[r][right - 1] = pair[1];
    }
    g[r][a] = front ? "@" : ".";
    g[r][b] = front ? "." : "@";
    if (right - left <= 1) g[r][left] = "X";
  }
  return render(g);
}

/* -------------------------------------------------------------------------- */
/* Approach: five noisy inputs stream into one core, then one clean line.     */
/* -------------------------------------------------------------------------- */
const noises = ["%;#", "?!^", "$~&", "{}=", "^%;"];

function clusterWide() {
  const g = grid(78, 13);
  const coreRow = 6;
  const coreCol = 50;
  const rows = [0, 3, 6, 9, 12];
  const offsets = [2, 6, 0, 5, 1];

  approach.cluster.forEach((label, i) => {
    const row = rows[i];
    const chip = `[ ${label} ]`;
    const start = offsets[i];
    put(g, row, start, noises[i]);
    put(g, row, start + 3, chip);
    const runStart = start + 3 + chip.length;
    const rise = coreRow - row;
    const diagonalCols = Math.abs(rise) * 3;
    const runEnd = coreCol - 2 - diagonalCols;
    put(g, row, runStart, stream(noises[(i + 2) % 5] + ":=", Math.max(2, runEnd - runStart)));
    for (let step = 1; step <= Math.abs(rise); step++) {
      const r = row + Math.sign(rise) * step;
      const c = runEnd + (step - 1) * 3;
      put(g, r, c, rise > 0 ? "`-." : ".-'");
    }
    if (rise === 0) put(g, row, runEnd, "-->");
  });

  put(g, coreRow - 3, coreCol, "  .-'''''-.");
  put(g, coreRow - 2, coreCol, " /         \\");
  put(g, coreRow - 1, coreCol, "|   .-^-.   |");
  put(g, coreRow, coreCol - 1, ">|  ( (*) )  |");
  put(g, coreRow + 1, coreCol, "|   '-v-'   |");
  put(g, coreRow + 2, coreCol, " \\         /");
  put(g, coreRow + 3, coreCol, "  '-.....-'");
  put(g, coreRow + 4, coreCol + 2, "ArdbergAI");
  put(g, coreRow, coreCol + 13, "============>");
  return render(g);
}

function clusterNarrow() {
  const g = grid(36, 21);
  const [a, b, c, d, e] = approach.cluster;
  put(g, 0, 0, `%;[ ${a} ]`);
  put(g, 1, 20, `[ ${b} ]^!`);
  put(g, 2, 10, "\\");
  put(g, 2, 26, "/");
  put(g, 3, 1, `$[ ${c} ]~&`);
  put(g, 4, 19, `[ ${d} ]{`);
  put(g, 5, 12, "\\");
  put(g, 5, 24, "/");
  put(g, 6, 3, `^[ ${e} ]%;`);
  put(g, 7, 17, "|");
  put(g, 8, 17, "v");
  put(g, 9, 11, ".-'''-.");
  put(g, 10, 10, "/       \\");
  put(g, 11, 9, "|  (*)    |");
  put(g, 12, 10, "\\       /");
  put(g, 13, 11, "'-...-'");
  put(g, 14, 13, "ArdbergAI");
  put(g, 15, 17, "|");
  put(g, 16, 17, "|");
  put(g, 17, 17, "v");
  return render(g);
}

/* -------------------------------------------------------------------------- */
/* Offer: one emblem per way of working.                                      */
/* -------------------------------------------------------------------------- */
const platforms = [
  "        ______________",
  "       /_____________/|",
  "     __________________|_",
  "    /___________________/|",
  "  _______________________|_",
  " /________________________/",
].join("\n");

const partnership = [
  " START                  FINISH",
  "  o--.    .--.    .--.    .--@",
  "      \\  /    \\  /    \\  /",
  "       \\/      \\/      \\/",
  "       /\\      /\\      /\\",
  "      /  \\    /  \\    /  \\",
  "  o--'    '--'    '--'    '--@",
].join("\n");

const embedding = [
  "            [##]",
  "             ||",
  " [==] [==]   \\/   [==] [==]",
  " [==] [==] [    ] [==] [==]",
  " [==] [==] [====] [==] [==]",
].join("\n");

/* -------------------------------------------------------------------------- */

export const art = {
  hero: heroDiagram(),
  helix: helix(),
  clusterWide: clusterWide(),
  clusterNarrow: clusterNarrow(),
  offer: [platforms, partnership, embedding],
  /** Result bars from the original "Unified system" card, as characters. */
  bars: [
    "                #",
    "          #     #",
    "    #     #  #  #",
    " #  #  #  #  #  #",
  ].join("\n"),
};
