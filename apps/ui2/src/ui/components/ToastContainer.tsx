import { useToast } from '../../shared/context/ToastContext';
import { Text } from '../primitives';
import './ToastContainer.css';

export function ToastContainer() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}`}
          role="alert"
          aria-live="assertive"
        >
          <div className="toast__content">
            <Text size="2" className="toast__message">
              {toast.message}
            </Text>
          </div>
          <button
            className="toast__close"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
