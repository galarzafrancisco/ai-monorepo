/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type JwkResponseDto = {
    /**
     * Key type, for example RSA or EC.
     */
    kty: string;
    /**
     * Key usage indicating how the key can be used.
     */
    use: string;
    /**
     * Unique identifier for the key used for rotation.
     */
    kid: string;
    /**
     * Algorithm intended for use with this key.
     */
    alg: string;
    /**
     * RSA modulus encoded using base64url.
     */
    'n'?: string;
    /**
     * RSA public exponent encoded using base64url.
     */
    'e'?: string;
    /**
     * Public coordinate X for EC keys encoded using base64url.
     */
    'x'?: string;
    /**
     * Public coordinate Y for EC keys encoded using base64url.
     */
    'y'?: string;
    /**
     * Curve name for EC keys.
     */
    crv?: string;
};

