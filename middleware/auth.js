const { createRemoteJWKSet, jwtVerify } = require("jose");

let authInstance = null;
let jwksCache = null;

function setAuthInstance(auth) {
  authInstance = auth;
}

function getJWKS() {
  if (!jwksCache) {
    const baseURL = process.env.BETTER_AUTH_URL;
    jwksCache = createRemoteJWKSet(new URL(`${baseURL}/api/auth/jwks`));
  }
  return jwksCache;
}

/**
 * Middleware: validates Bearer JWT from Authorization header.
 * The JWT is issued by BetterAuth's /api/auth/token endpoint and
 * verified against /api/auth/jwks using the jose library.
 */
async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided. Please login." });
    }

    const token = authHeader.split(" ")[1];
    const baseURL = process.env.BETTER_AUTH_URL;

    const { payload } = await jwtVerify(token, getJWKS(), {
      issuer: baseURL,
      audience: baseURL,
    });

    req.user = {
      uid: payload.id || payload.sub,
      email: payload.email,
      name: payload.name,
      photo: payload.image || "",
    };

    next();
  } catch (error) {
    if (error.code === "ERR_JWKS_NO_MATCHING_KEY") {
      jwksCache = null;
      return res.status(401).json({ message: "Token key rotated. Please login again." });
    }
    if (error.code === "ERR_JWT_EXPIRED") {
      return res.status(401).json({ message: "Token expired. Please login again." });
    }
    console.error("JWT verification error:", error.message);
    return res.status(401).json({ message: "Invalid token." });
  }
}

module.exports = { authenticateToken, setAuthInstance };
