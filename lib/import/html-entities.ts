// Decodificador de entidades HTML usado ao raspar chess-results.com e CBX.
// Cobre referências numéricas (decimais e hex) e as entidades nomeadas mais
// comuns em português/latim — suficiente para os títulos de torneio que
// interessam aqui; entidades de outros alfabetos (cirílico, etc.) que não
// estiverem no mapa passam a limpo pela decodificação numérica, que é a
// forma mais comum usada pelo chess-results.
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ',
  Aacute: 'Á', aacute: 'á', Eacute: 'É', eacute: 'é', Iacute: 'Í', iacute: 'í',
  Oacute: 'Ó', oacute: 'ó', Uacute: 'Ú', uacute: 'ú',
  Atilde: 'Ã', atilde: 'ã', Otilde: 'Õ', otilde: 'õ', Ntilde: 'Ñ', ntilde: 'ñ',
  Ccedil: 'Ç', ccedil: 'ç',
  Acirc: 'Â', acirc: 'â', Ecirc: 'Ê', ecirc: 'ê', Ocirc: 'Ô', ocirc: 'ô',
  Agrave: 'À', agrave: 'à', Egrave: 'È', egrave: 'è',
  Auml: 'Ä', auml: 'ä', Euml: 'Ë', euml: 'ë', Iuml: 'Ï', iuml: 'ï',
  Ouml: 'Ö', ouml: 'ö', Uuml: 'Ü', uuml: 'ü',
  szlig: 'ß', ordf: 'ª', ordm: 'º', deg: '°', middot: '·',
};

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (match, name) => NAMED_ENTITIES[name] ?? match);
}

export function stripHtmlTags(input: string): string {
  return decodeHtmlEntities(input.replace(/<[^>]+>/g, '')).trim();
}
