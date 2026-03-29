import type { UserRole } from "../middleware/auth";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: {
        id: number;
        username: string;
        role: UserRole;
      };
    }
  }
}

export {};