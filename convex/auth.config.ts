const issuerBase = process.env.HOSTED_URL ?? "http://localhost:3000";

const issuer = `${issuerBase.replace(/\/$/, "")}/api/convex-auth`;
const audience = process.env.CONVEX_AUTH_AUDIENCE ?? "manef-ui";

export default {
  providers: [
    {
      domain: issuer,
      applicationID: audience,
      jwks: `${issuer}/.well-known/jwks.json`,
      type: "customJwt",
    },
  ],
};
