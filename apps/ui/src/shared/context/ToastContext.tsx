import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  showError: (error: unknown) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

/**
 * Extracts a user-friendly error message from various error shapes
 * Handles backend Problem Details format and generic errors
 */
function extractErrorMessage(error: unknown): string {
  // Backend Problem Details format (RFC 7807)
  if (error && typeof error === 'object') {
    const err = error as any;

    // Check for Problem Details in body
    if (err.body?.detail) {
      return err.body.detail;
    }

    // Check for Problem Details at top level
    if (err.detail) {
      return err.detail;
    }

    // Check for generic message
    if (err.message) {
      return err.message;
    }
  }

  // Fallback for string errors
  if (typeof error === 'string') {
    return error;
  }

  // Ultimate fallback
  return 'An unexpected error occurred';
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration: number = 5000) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, toast]);

    // Auto-dismiss after duration
    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, []);

  const showError = useCallback((error: unknown) => {
    const message = extractErrorMessage(error);
    showToast(message, 'error', 6000);
  }, [showToast]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, showError, dismissToast }}>
      {children}
    </ToastContext.Provider>
  );
}
