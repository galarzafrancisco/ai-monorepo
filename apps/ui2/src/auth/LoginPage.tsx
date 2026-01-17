import { LoginShell } from "./LoginShell";
import { LoginForm } from "./LoginForm";
import "./LoginPage.css";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  return (
    <LoginShell>
      <LoginForm />
    </LoginShell>
  );
}
