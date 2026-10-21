import { AiProviderRequestFailedError } from '../errors/ai-providers.errors';
import { MANAGE_USAGE_URL } from './chatgpt-subscription.constants';

export type UpstreamFailure = {
  /** OpenAI's error code, or one of the stream codes below. */
  code: string | null;
  message: string | null;
  status?: number | null;
  param?: string | null;
  requestId?: string | null;
};

/** The stream ended in a way that is not `response.completed`. */
export const STREAM_INCOMPLETE = 'response_incomplete';
export const STREAM_ENDED_EARLY = 'stream_ended_before_completion';
export const STREAM_FAILED = 'response_failed';

const NOT_SWITCHED = 'Taico did not switch to another provider.';

/**
 * What to tell the person, by OpenAI's error code. None of these are retried
 * automatically and none fall back to a provider that bills an API key.
 */
function describe(failure: UpstreamFailure): string {
  switch (failure.code) {
    case 'subscription_sharing_usage_limit_exceeded':
      return `You have reached the usage limit of your ChatGPT plan. See your usage at ${MANAGE_USAGE_URL}.`;
    case 'subscription_sharing_usage_unavailable':
    case 'subscription_sharing_user_unavailable':
      return 'ChatGPT plan usage is temporarily unavailable. Your connection was kept; try again later.';
    case 'subscription_sharing_user_not_eligible':
      return 'This ChatGPT account is not eligible to use its plan in other apps.';
    case 'subscription_sharing_unsupported_capability':
      return `The ChatGPT plan does not support something in this request${
        failure.param ? ` (${failure.param})` : ''
      }. The request was not sent again.`;
    case 'subscription_sharing_route_not_supported':
      return 'The ChatGPT plan cannot be used for this kind of request.';
    case 'subscription_sharing_invalid_user':
      return 'OpenAI did not accept the connected ChatGPT account for this request.';
    case 'chatpass_v2_scope_not_authorized':
    case 'chatpass_v2_invalid_authorization_context':
      return 'The ChatGPT connection does not allow this request. Disconnect and connect again in Settings → AI models.';
    case STREAM_INCOMPLETE:
      return `The ChatGPT plan stopped before finishing the answer${
        failure.message ? ` (${failure.message})` : ''
      }.`;
    case STREAM_ENDED_EARLY:
      return 'The connection to OpenAI closed before the answer was complete.';
  }

  switch (failure.status) {
    case 401:
      return 'OpenAI did not accept the ChatGPT sign-in for this request.';
    case 403:
      return 'OpenAI refused this request for the connected ChatGPT account. It may not be available in your region or under your plan.';
    case 503:
      return 'ChatGPT plan usage is temporarily unavailable. Try again later.';
  }

  return failure.message
    ? `The ChatGPT plan request failed: ${failure.message}`
    : 'The ChatGPT plan request failed.';
}

export function chatgptRequestFailed(
  failure: UpstreamFailure,
): AiProviderRequestFailedError {
  return new AiProviderRequestFailedError(
    `${describe(failure)} ${NOT_SWITCHED}`,
    {
      upstreamCode:
        failure.code ?? (failure.status ? `http_${failure.status}` : 'unknown'),
      upstreamMessage: failure.message,
      status: failure.status ?? null,
      param: failure.param ?? null,
      requestId: failure.requestId ?? null,
    },
  );
}
