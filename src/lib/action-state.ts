// =============================================================================
//  lib/action-state.ts
// =============================================================================
//  The shape a console form action hands back, kept OUT of the 'use server'
//  file: Next allows a server-action module to export async functions and
//  nothing else, so a plain constant there breaks the build.
// =============================================================================

export interface FieldErrors {
  [field: string]: string;
}

export interface ActionState {
  ok: boolean;
  errors: FieldErrors;
  message: string;
}

export const EMPTY_STATE: ActionState = { ok: true, errors: {}, message: '' };

export function fail(errors: FieldErrors, message = ''): ActionState {
  return { ok: false, errors, message };
}
