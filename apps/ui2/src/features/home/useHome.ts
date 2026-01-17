import { useState } from 'react';

export const useHome = () => {
  const [message] = useState<string | null>("Message coming from useHome");

  return {
    message,
  };
};
