export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^a-z0-9\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string): string[] {
  const normalized = normalizeText(input);
  if (!normalized) {
    return [];
  }
  return normalized.split(' ').filter((token) => token.length > 1);
}

export function unique<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

export function diceCoefficient(a: string, b: string): number {
  const aNorm = normalizeText(a);
  const bNorm = normalizeText(b);

  if (!aNorm || !bNorm) {
    return 0;
  }

  const biGrams = (value: string): string[] => {
    if (value.length < 2) {
      return [value];
    }
    const grams: string[] = [];
    for (let i = 0; i < value.length - 1; i += 1) {
      grams.push(value.slice(i, i + 2));
    }
    return grams;
  };

  const aBigrams = biGrams(aNorm);
  const bBigrams = biGrams(bNorm);
  const bMap = new Map<string, number>();

  for (const gram of bBigrams) {
    bMap.set(gram, (bMap.get(gram) || 0) + 1);
  }

  let overlap = 0;
  for (const gram of aBigrams) {
    const count = bMap.get(gram) || 0;
    if (count > 0) {
      overlap += 1;
      bMap.set(gram, count - 1);
    }
  }

  return (2 * overlap) / (aBigrams.length + bBigrams.length);
}
