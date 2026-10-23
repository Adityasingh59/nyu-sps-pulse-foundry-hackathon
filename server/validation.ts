// Request validation shared by the legacy Express API and the cloud routes.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function textInput(value: unknown, field: string, max = 400): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new ApiError(
      400,
      `${field} must be a non-empty string of at most ${max} characters.`,
    );
  return value.trim();
}
