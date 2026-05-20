const { betterAuth } = require("better-auth");
const { mongodbAdapter } = require("better-auth/adapters/mongodb");
const { jwt } = require("better-auth/plugins");

let authInstance = null;

function createAuth(db) {
  if (authInstance) return authInstance;

  authInstance = betterAuth({
    database: mongodbAdapter(db),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    trustedOrigins: [
      process.env.CLIENT_URL,
    ].filter(Boolean),
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
    },
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        enabled: !!(
          process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.GOOGLE_CLIENT_ID !== "your_google_client_id_here"
        ),
      },
    },
    plugins: [
      jwt({
        jwt: {
          expirationTime: "7d",
          definePayload: ({ user }) => ({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image || "",
          }),
        },
        jwks: {
          keyPairConfig: {
            alg: "EdDSA",
          },
        },
      }),
    ],
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
    },
  });

  return authInstance;
}

module.exports = { createAuth };
