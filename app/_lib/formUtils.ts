/** Shared FormData helpers for server actions (kept out of 'use server' files — those may only export async functions). */

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function formString(formData: FormData, key: string, fallback = ''): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : fallback;
}
