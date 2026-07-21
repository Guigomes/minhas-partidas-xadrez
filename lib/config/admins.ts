// E-mails Google com acesso ao painel de administração.
// Precisa bater exatamente com as regras do Firestore (firestore.rules).
export const ADMIN_EMAILS = ['guigomes.ti@gmail.com'];

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}
