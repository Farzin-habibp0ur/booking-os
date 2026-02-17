const PHONE_REGEX = /^\+?[\d\s\-()]{7,}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(name: string): string | null {
  if (!name.trim()) return 'Name is required';
  if (name.trim().length < 2) return 'Name must be at least 2 characters';
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone.trim()) return 'Phone number is required';
  if (!PHONE_REGEX.test(phone.trim())) return 'Please enter a valid phone number';
  return null;
}

export function validateEmail(email: string): string | null {
  if (!email.trim()) return null; // optional
  if (!EMAIL_REGEX.test(email.trim())) return 'Please enter a valid email address';
  return null;
}
