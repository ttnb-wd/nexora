export function authErrorMessage(error: { code?: string; status?: number } | null | undefined) {
  if (error?.code === "EMAIL_NOT_VERIFIED") return "Please verify your email before continuing.";
  if (error?.code === "INVALID_RESET") return "This reset link could not be used. Request a new one and try again.";
  if (error?.status === 429 || error?.code === "TOO_MANY_REQUESTS") return "Too many attempts. Please wait a minute and try again.";
  if (error?.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || error?.code === "USER_ALREADY_EXISTS") return "An account with this email already exists.";
  if (error?.code === "INVALID_EMAIL_OR_PASSWORD") return "Invalid email or password.";
  if (error?.code === "VALIDATION_ERROR") return "Check your details and try again.";
  if (error?.code === "FORBIDDEN") return "This request could not be verified. Refresh the page and try again.";
  return "Account access is temporarily unavailable. Please try again shortly.";
}
