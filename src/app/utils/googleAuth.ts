import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

let googleClient: OAuth2Client | null = null;

const getGoogleClient = (): OAuth2Client => {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "Google authentication is not configured");
  }

  googleClient ??= new OAuth2Client(env.GOOGLE_CLIENT_ID);
  return googleClient;
};

export type VerifiedGoogleIdentity = {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
};

export const verifyGoogleCredential = async (
  credential: string,
): Promise<VerifiedGoogleIdentity> => {
  try {
    const client = getGoogleClient();
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new AppError(401, "Google account email could not be verified");
    }

    const nameParts = (payload.name ?? "Google User").trim().split(/\s+/);
    const fallbackFirstName = nameParts[0] || "Google";
    const fallbackLastName = nameParts.slice(1).join(" ") || "User";

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      firstName: payload.given_name?.trim() || fallbackFirstName,
      lastName: payload.family_name?.trim() || fallbackLastName,
      avatarUrl: payload.picture,
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(401, "Invalid Google credential");
  }
};
