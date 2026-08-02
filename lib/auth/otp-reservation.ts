/** Stable in-process key for a particular OTP issuance. The normalized email
 * cannot include NUL, so two identifier/hash pairs cannot collide. */
export function otpReservationKey(identifier: string, tokenHash: string): string {
  return `${identifier}\u0000${tokenHash}`;
}
