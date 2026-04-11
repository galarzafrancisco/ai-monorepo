import { useEffect, useState } from 'react';
import { AuthorizationServerService } from './api';
import type { ConsentDecisionDto, GetConsentMetadataResponseDto } from './api';
import { BFF_BASE_URL } from '../../config/api';

export const useConsent = () => {
  console.log('useConsent mounting');
  const [message, setMessage] = useState<string | null>(null);

  const [consentMetadata, setConsentMetadata] = useState<GetConsentMetadataResponseDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Boot
  useEffect(() => {
    console.log('useConsent setting message');
    setMessage("Message coming from useConsent");
  }, []);

  const loadConsentMetadata = async (flowId: string) => {
    if (!flowId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await AuthorizationServerService.AuthorizationController_getConsentMetadata({ flowId });
      setConsentMetadata(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load authorization details');
    } finally {
      setIsLoading(false);
    }
  };

  const submitConsent = async (flowId: string, serverId: string, approved: boolean) => {
    setIsApproving(true);
    setError(null);

    try {

      const consentData: ConsentDecisionDto = {
        flow_id: flowId,
        approved: approved,
      };

      const bffBaseUrl = BFF_BASE_URL || window.location.origin;
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `${bffBaseUrl}/api/v1/auth/authorize/mcp/${serverId}/0.0.0`;

      // Create form fields matching ConsentDecisionDto
      Object.entries(consentData).forEach(([key, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit consent decision');
      setIsApproving(false);
    }
  }

  return {
    message,
    setMessage,
    loadConsentMetadata,
    consentMetadata,
    submitConsent,
    error,
    isApproving,
    isLoading,
  };
};
