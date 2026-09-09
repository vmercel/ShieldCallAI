/**
 * Local lab tester — __DEV__ only. Does not hit Supabase mail.
 * Not a production account. Not a secret worth protecting.
 */

export const LAB_EMAIL = 'lab@shieldcall.local';
export const LAB_PASSWORD = 'shieldcall-lab';
export const LAB_OTP = '000000';

export function isLabEmail(email: string): boolean {
  return email.trim().toLowerCase() === LAB_EMAIL;
}

export function isLabPassword(password: string): boolean {
  return password === LAB_PASSWORD;
}

export function isLabOtp(token: string): boolean {
  return token.trim() === LAB_OTP;
}
