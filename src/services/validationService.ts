// User validation
export interface UserValidationResult {
  isValid: boolean;
  error?: string;
}

export function validateCompanyCardId(
  companyCardId: string | undefined | null, 
  existingUsers: Array<{ id: string; company_card_id: string | null; full_name: string | null }>,
  excludeUserId?: string
): UserValidationResult {
  if (!companyCardId) {
    return { isValid: false, error: 'ID je obavezno polje' };
  }

  if (!/^[0-9]+$/.test(companyCardId)) {
    return { isValid: false, error: 'ID mora biti numerička vrednost' };
  }

  if (companyCardId.length > 10) {
    return { isValid: false, error: 'ID može imati maksimalno 10 cifara' };
  }

  const existingUser = existingUsers.find(u => 
    u.company_card_id === companyCardId && 
    u.id !== excludeUserId
  );
  
  if (existingUser) {
    return { 
      isValid: false, 
      error: `ID ${companyCardId} je već dodeljen korisniku ${existingUser.full_name}` 
    };
  }

  return { isValid: true };
}

export function validatePassword(password: string | undefined, required: boolean = false): UserValidationResult {
  if (!required && !password) {
    return { isValid: true };
  }

  if (required && (!password || password.length < 6)) {
    return { isValid: false, error: 'Lozinka mora imati najmanje 6 karaktera' };
  }

  if (password && password.length < 6) {
    return { isValid: false, error: 'Lozinka mora imati najmanje 6 karaktera' };
  }

  return { isValid: true };
}

// Meal validation
export function validateMealCode(
  code: string | undefined | null,
  existingMeals: Array<{ id: string; code: string | null; name: string }>,
  excludeMealId?: string
): UserValidationResult {
  if (!code) {
    return { isValid: true }; // Code is optional
  }

  const existingMeal = existingMeals.find(m => 
    m.code === code && m.id !== excludeMealId
  );
  
  if (existingMeal) {
    return { 
      isValid: false, 
      error: `Šifra "${code}" već postoji za obrok "${existingMeal.name}"` 
    };
  }

  return { isValid: true };
}
