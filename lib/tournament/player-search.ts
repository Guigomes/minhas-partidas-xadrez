// Normalização de nomes e chaves de busca de jogadores — compartilhado
// entre a rota de importação (servidor) e a tela de busca (cliente).

export function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .split('')
    .filter((ch) => ch.charCodeAt(0) < 0x0300 || ch.charCodeAt(0) > 0x036f)
    .join('')
    .toLowerCase();
}

export function nameWords(s: string): string[] {
  return normalizeText(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Palavras em ordem alfabética: "Silva, Miguel Oliveira" e "Miguel Oliveira
// Silva" viram a mesma chave (o chess-results alterna as duas convenções).
export function nameKey(s: string): string {
  return nameWords(s).sort().join('-');
}

const MIN_PREFIX = 3;

// O Firestore não tem busca por substring; guardamos no jogador todos os
// prefixos (a partir de 3 letras) de cada palavra do nome, mais os IDs, e a
// busca faz `array-contains` com a palavra mais longa digitada.
export function searchTokens(name: string, ids: (string | null)[]): string[] {
  const tokens = new Set<string>();
  for (const word of nameWords(name)) {
    if (word.length < MIN_PREFIX) continue;
    for (let i = MIN_PREFIX; i <= word.length; i++) tokens.add(word.slice(0, i));
  }
  for (const id of ids) if (id) tokens.add(id);
  return [...tokens];
}

// Termos da busca: palavras do texto digitado (ou um ID numérico).
export function queryTerms(input: string): string[] {
  return nameWords(input).filter((w) => w.length >= MIN_PREFIX || /^\d+$/.test(w));
}

export function playerKey(p: { cbx_id: string | null; fide_id: string | null; name: string }): string {
  if (p.cbx_id) return `cbx-${p.cbx_id}`;
  if (p.fide_id) return `fide-${p.fide_id}`;
  return `nome-${nameKey(p.name)}`;
}
