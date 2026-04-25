export type AgreementMatrix = {
  parties: string[];
  matrix: (number | null)[][];
  shared: number[][];
  voteCount: number;
};

export function computeAgreement(
  voteIds: number[],
  majorities: Record<string, Record<string, number>>,
  partyOrder: string[],
  minShared = 25,
): AgreementMatrix {
  const partyIdx = new Map(partyOrder.map((p, i) => [p, i]));
  const n = partyOrder.length;
  const shared: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const same: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  let counted = 0;
  for (const voteId of voteIds) {
    const m = majorities[String(voteId)];
    if (!m) continue;
    counted++;
    const entries = Object.entries(m).filter(([p]) => partyIdx.has(p));
    for (let i = 0; i < entries.length; i++) {
      const ai = partyIdx.get(entries[i][0])!;
      const ta = entries[i][1];
      for (let j = i + 1; j < entries.length; j++) {
        const bi = partyIdx.get(entries[j][0])!;
        const tb = entries[j][1];
        shared[ai][bi]++;
        shared[bi][ai]++;
        if (ta === tb) {
          same[ai][bi]++;
          same[bi][ai]++;
        }
      }
    }
  }

  const matrix: (number | null)[][] = Array.from(
    { length: n },
    () => new Array<number | null>(n).fill(null),
  );
  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (shared[i][j] >= minShared) {
        matrix[i][j] = Math.round((same[i][j] / shared[i][j]) * 10000) / 10000;
      }
    }
  }

  return { parties: partyOrder, matrix, shared, voteCount: counted };
}
