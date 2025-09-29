import jwt from "jsonwebtoken";

/**
 * Creates an Access Token.
 * @param {object} payload - The payload to include in the token.
 * @returns {string} The generated JWT.
 */
export const createAccessToken = (payload) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY; // 15 minutes
  // Add a timestamp to the payload for randomness
  const payloadWithTimestamp = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
  };
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not defined in the environment variables.");
  }
  return jwt.sign(payloadWithTimestamp, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
};

/**
 * Verifies an Access Token.
 * @param {string} token - The JWT to verify.
 * @returns {object | null} The decoded payload if the token is valid, otherwise null.
 */
export const verifyAccessToken = (token) => {
  const JWT_SECRET = process.env.JWT_SECRET;
  const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY; // 15 minutes
  try {
    if (!JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined for verification.");
    }
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};
