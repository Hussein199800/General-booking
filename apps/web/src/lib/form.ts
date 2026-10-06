/** A text field from a submitted form ('' when absent or a file). */
export function formText(form: FormData, name: string, options: { trim?: boolean } = {}): string {
  const value = form.get(name);
  if (typeof value !== 'string') return '';
  return options.trim === false ? value : value.trim();
}
