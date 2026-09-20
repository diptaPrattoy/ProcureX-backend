import type { UserRole } from "../generated/prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};
