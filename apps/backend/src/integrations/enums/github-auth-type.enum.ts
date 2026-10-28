/** How a GitHub connection authenticates. */
export enum GithubAuthType {
  /** A personal access token (classic or fine-grained), used as is. */
  PAT = 'pat',
  /**
   * A GitHub App installation. Taico signs a JWT with the app's private key and
   * exchanges it for short-lived installation tokens.
   */
  APP = 'app',
}
