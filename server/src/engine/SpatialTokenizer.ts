export interface SpatialToken {
  id: string;
  text: string;
  type: 'NIF_VAT' | 'DATE' | 'MONETARY_OR_NUM' | 'PERCENTAGE' | 'ALPHA_CONCEPT';
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export class SpatialTokenizer {
  static tokenize(rawText = '', boundingBoxes: any[] = []): SpatialToken[] {
    const tokens: SpatialToken[] = [];

    if (boundingBoxes && boundingBoxes.length > 0) {
      boundingBoxes.forEach((box, idx) => {
        const text = box.text?.trim() || '';
        if (!text) return;

        tokens.push({
          id: `tok-${idx}`,
          text,
          type: this.classifyTokenType(text),
          x: box.x || 0,
          y: box.y || 0,
          width: box.width || 0,
          height: box.height || 0,
          confidence: box.confidence || 98.0
        });
      });
      return tokens;
    }

    const lines = rawText.split('\n');
    let currentY = 50;

    lines.forEach((line, lineIdx) => {
      const words = line.trim().split(/\s+/);
      let currentX = 40;

      words.forEach((word, wordIdx) => {
        if (!word) return;

        const w = Math.max(word.length * 9, 20);
        tokens.push({
          id: `tok-${lineIdx}-${wordIdx}`,
          text: word,
          type: this.classifyTokenType(word),
          x: currentX,
          y: currentY,
          width: w,
          height: 18,
          confidence: 99.0
        });

        currentX += w + 8;
      });

      currentY += 24;
    });

    return tokens;
  }

  static classifyTokenType(text: string): 'NIF_VAT' | 'DATE' | 'MONETARY_OR_NUM' | 'PERCENTAGE' | 'ALPHA_CONCEPT' {
    const clean = text.replace(/[€$,]/g, '').trim();

    if (/^[A-Z0-9]{8,12}$/i.test(text) && /\d/.test(text) && /[a-z]/i.test(text)) {
      return 'NIF_VAT';
    }

    if (/^\d{1,2}[-/\.]\d{1,2}[-/\.]\d{2,4}$/.test(text)) {
      return 'DATE';
    }

    if (/^[\$€£]?\s*-?\d+([.,]\d{2})?\s*[\$€£]?$/.test(text) || !isNaN(parseFloat(clean))) {
      return 'MONETARY_OR_NUM';
    }

    if (/^\d+([.,]\d+)?%$/.test(text)) {
      return 'PERCENTAGE';
    }

    return 'ALPHA_CONCEPT';
  }
}
