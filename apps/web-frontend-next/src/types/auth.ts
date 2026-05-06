export interface AuthUser {
  id: number | string;
  email: string;
  role: "admin" | "viewer";
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}
