import { useEffect, useState } from 'react';

export const useHome = () => {
  console.log('useHome mounting');
  const [message, setMessage] = useState<string | null>(null);
  
  // Boot
  useEffect(() => {
    console.log('useHome setting message');
    setMessage("Hello!");
  }, []);

  return {
    message,
    setMessage,
  };
};
