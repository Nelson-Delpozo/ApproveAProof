export type AuthorizationTransaction = {
  codeVerifier: string;
  state: string;
  nonce: string;
};