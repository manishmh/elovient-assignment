export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export class AppError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
