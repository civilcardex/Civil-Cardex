import { describe, it, expect } from 'vitest';
import { mensajeAuthGenerico } from '../authMessage.ts';

/**
 * El login no debe delatar cuentas: "User already registered" confirma que un correo
 * existe — todos los códigos se traducen a textos genéricos y lo desconocido cae al
 * fallback. Ej: {message:'User already registered'} → "No se pudo crear la cuenta...".
 */

const errCon = (m: string) => new Error(m);

describe('mensajeAuthGenerico · mensajes sin enumeración de usuarios', () => {
  it('credenciales inválidas y correo sin confirmar caen al mismo texto genérico', () => {
    const esperado =
      'Credenciales inválidas o cuenta sin confirmar. Revisa tu correo y contraseña.';
    expect(mensajeAuthGenerico(errCon('Invalid login credentials'), 'fb')).toBe(esperado);
    expect(mensajeAuthGenerico(errCon('Email not confirmed'), 'fb')).toBe(esperado);
  });

  it('el matching ignora mayúsculas (el SDK cambia el casing entre versiones)', () => {
    expect(mensajeAuthGenerico(errCon('EMAIL NOT CONFIRMED'), 'fb')).toContain('Credenciales');
  });

  it('"User already registered" NO delata la cuenta: pide iniciar sesión sin confirmar existencia', () => {
    const msg = mensajeAuthGenerico(errCon('User already registered'), 'fb');
    expect(msg).toBe(
      'No se pudo crear la cuenta. Si ya tienes una, inicia sesión o recupera tu contraseña.',
    );
  });

  it('política de contraseña: menciona "password" y "least" pero sin cifra (el mínimo lo fija el Dashboard)', () => {
    const msg = mensajeAuthGenerico(errCon('New password should be at least 8 characters'), 'fb');
    expect(msg).toBe(
      'La contraseña no cumple la política de seguridad del proyecto: usa una más larga o más compleja.',
    );
  });

  it('rate limit (dos variantes del SDK) pide esperar', () => {
    const esperado = 'Demasiados intentos. Espera un momento y vuelve a intentar.';
    expect(mensajeAuthGenerico(errCon('Rate limit exceeded'), 'fb')).toBe(esperado);
    expect(mensajeAuthGenerico(errCon('Too many requests'), 'fb')).toBe(esperado);
  });

  it('error desconocido y no-Error (string/null) caen al fallback sin inventar texto', () => {
    expect(mensajeAuthGenerico(errCon('Database unavailable'), 'fb')).toBe('fb');
    expect(mensajeAuthGenerico('User already registered', 'fb')).toBe('fb');
    expect(mensajeAuthGenerico(null, 'fb')).toBe('fb');
  });
});
