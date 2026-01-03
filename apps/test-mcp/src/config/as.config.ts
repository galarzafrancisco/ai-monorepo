import { SELF_NAME, SELF_VERSION } from "./self.config";

export const AUTHORIZATION_SERVER_BASE_URL = process.env.AUTHORIZATION_SERVER_BASE_URL || `http://localhost:3000`;
export const AUTHORIZATION_SERVER_URL = `${AUTHORIZATION_SERVER_BASE_URL}/mcp/${SELF_NAME}/${SELF_VERSION}`;
export const TOKEN_EXCHANGE_URL = `${AUTHORIZATION_SERVER_BASE_URL}/api/v1/auth/token-exchange/mcp/${SELF_NAME}/${SELF_VERSION}`;