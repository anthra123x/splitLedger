import { SpatialToken } from './SpatialTokenizer.js';

export interface SpatialRow {
  tokens: SpatialToken[];
  text: string;
  hasMonetary: boolean;
  hasAlpha: boolean;
  y: number;
}

export interface SpatialCluster {
  rowIndex: number;
  conceptCandidate: string;
  monetaryTokens: string[];
  bounds: {
    x: number;
    y: number;
    w: number;
    h: number;
    confidence: number;
  };
}

export interface SpatialGraphResult {
  totalRows: number;
  candidateLineItemsCount: number;
  clusters: SpatialCluster[];
  rawRowsText: string[];
}

export class SpatialAttentionGraph {
  static buildGraph(tokens: SpatialToken[] = [], yTolerance = 14): SpatialGraphResult {
    if (!tokens || tokens.length === 0) {
      return { totalRows: 0, candidateLineItemsCount: 0, clusters: [], rawRowsText: [] };
    }

    const sortedByY = [...tokens].sort((a, b) => a.y - b.y);
    const rows: SpatialRow[] = [];
    let currentRow: SpatialToken[] = [sortedByY[0]];

    for (let i = 1; i < sortedByY.length; i++) {
      const prev = currentRow[currentRow.length - 1];
      const curr = sortedByY[i];

      if (Math.abs(curr.y - prev.y) <= yTolerance) {
        currentRow.push(curr);
      } else {
        currentRow.sort((a, b) => a.x - b.x);
        rows.push(this.synthesizeRow(currentRow));
        currentRow = [curr];
      }
    }

    if (currentRow.length > 0) {
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(this.synthesizeRow(currentRow));
    }

    const candidateLineItems = rows.filter(r => r.hasMonetary && r.hasAlpha);

    const structuredClusters: SpatialCluster[] = candidateLineItems.map((row, idx) => {
      const concepts = row.tokens.filter(t => t.type === 'ALPHA_CONCEPT').map(t => t.text).join(' ');
      const monetary = row.tokens.filter(t => t.type === 'MONETARY_OR_NUM');

      const bounds = {
        x: Math.min(...row.tokens.map(t => t.x)),
        y: Math.min(...row.tokens.map(t => t.y)),
        w: Math.max(...row.tokens.map(t => t.x + t.width)) - Math.min(...row.tokens.map(t => t.x)),
        h: Math.max(...row.tokens.map(t => t.height)),
        confidence: Math.round(row.tokens.reduce((acc, t) => acc + t.confidence, 0) / row.tokens.length * 10) / 10
      };

      return {
        rowIndex: idx + 1,
        conceptCandidate: concepts,
        monetaryTokens: monetary.map(m => m.text),
        bounds
      };
    });

    return {
      totalRows: rows.length,
      candidateLineItemsCount: candidateLineItems.length,
      clusters: structuredClusters,
      rawRowsText: rows.map(r => r.text)
    };
  }

  static synthesizeRow(tokens: SpatialToken[]): SpatialRow {
    const text = tokens.map(t => t.text).join(' ');
    const hasMonetary = tokens.some(t => t.type === 'MONETARY_OR_NUM');
    const hasAlpha = tokens.some(t => t.type === 'ALPHA_CONCEPT');

    return {
      tokens,
      text,
      hasMonetary,
      hasAlpha,
      y: tokens[0].y
    };
  }
}
