import { toast } from '@/hooks/use-toast';

// Error types for categorization
export type ErrorCategory = 
  | 'fetch'
  | 'create'
  | 'update'
  | 'delete'
  | 'auth'
  | 'upload'
  | 'validation'
  | 'network'
  | 'unknown';

// Entity types for error messages
export type EntityType = 
  | 'obrok'
  | 'jelovnik'
  | 'korisnik'
  | 'porudžbina'
  | 'povratna informacija'
  | 'predlog'
  | 'slika'
  | 'podaci';

// Error message mapping
const ERROR_MESSAGES: Record<ErrorCategory, Record<'success' | 'error', (entity: EntityType) => string>> = {
  fetch: {
    success: (entity) => `${capitalize(entity)} uspešno učitan`,
    error: (entity) => `Nije moguće učitati ${entity.toLowerCase()}`
  },
  create: {
    success: (entity) => `${capitalize(entity)} uspešno kreiran`,
    error: (entity) => `Nije moguće kreirati ${entity.toLowerCase()}`
  },
  update: {
    success: (entity) => `${capitalize(entity)} uspešno ažuriran`,
    error: (entity) => `Nije moguće ažurirati ${entity.toLowerCase()}`
  },
  delete: {
    success: (entity) => `${capitalize(entity)} uspešno obrisan`,
    error: (entity) => `Nije moguće obrisati ${entity.toLowerCase()}`
  },
  auth: {
    success: () => 'Uspešna autentifikacija',
    error: () => 'Greška pri autentifikaciji'
  },
  upload: {
    success: (entity) => `${capitalize(entity)} uspešno otpremljen`,
    error: (entity) => `Nije moguće otpremiti ${entity.toLowerCase()}`
  },
  validation: {
    success: () => 'Validacija uspešna',
    error: () => 'Greška pri validaciji'
  },
  network: {
    success: () => 'Konekcija uspostavljena',
    error: () => 'Greška u mrežnoj konekciji'
  },
  unknown: {
    success: () => 'Operacija uspešna',
    error: () => 'Došlo je do neočekivane greške'
  }
};

// Plural forms for entities
const ENTITY_PLURAL: Record<EntityType, string> = {
  'obrok': 'obroci',
  'jelovnik': 'jelovnici',
  'korisnik': 'korisnici',
  'porudžbina': 'porudžbine',
  'povratna informacija': 'povratne informacije',
  'predlog': 'predlozi',
  'slika': 'slike',
  'podaci': 'podaci'
};

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export interface HandleErrorOptions {
  category: ErrorCategory;
  entity: EntityType;
  error: unknown;
  showToast?: boolean;
  customMessage?: string;
  logToConsole?: boolean;
}

export interface HandleSuccessOptions {
  category: ErrorCategory;
  entity: EntityType;
  showToast?: boolean;
  customMessage?: string;
  plural?: boolean;
}

/**
 * Centralized error handler
 */
export function handleError({
  category,
  entity,
  error,
  showToast = true,
  customMessage,
  logToConsole = true
}: HandleErrorOptions): void {
  const message = customMessage || ERROR_MESSAGES[category].error(entity);
  
  if (logToConsole) {
    console.error(`[${category.toUpperCase()}] ${message}:`, error);
  }
  
  if (showToast) {
    toast({
      title: 'Greška',
      description: message,
      variant: 'destructive'
    });
  }
}

/**
 * Centralized success handler
 */
export function handleSuccess({
  category,
  entity,
  showToast = true,
  customMessage,
  plural = false
}: HandleSuccessOptions): void {
  const entityName = plural ? ENTITY_PLURAL[entity] : entity;
  const message = customMessage || ERROR_MESSAGES[category].success(entityName as EntityType);
  
  if (showToast) {
    toast({
      title: 'Uspeh',
      description: message
    });
  }
}

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Nepoznata greška';
}

/**
 * Wrapper for async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: Omit<HandleErrorOptions, 'error'>
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handleError({ ...options, error });
    return null;
  }
}

/**
 * Wrapper for async operations with success and error handling
 */
export async function withResultHandling<T>(
  operation: () => Promise<T>,
  errorOptions: Omit<HandleErrorOptions, 'error'>,
  successOptions?: HandleSuccessOptions
): Promise<{ data: T | null; error: unknown | null }> {
  try {
    const data = await operation();
    if (successOptions) {
      handleSuccess(successOptions);
    }
    return { data, error: null };
  } catch (error) {
    handleError({ ...errorOptions, error });
    return { data: null, error };
  }
}
