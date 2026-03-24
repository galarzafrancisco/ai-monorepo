import { LoginShell } from "./LoginShell";
import { OnboardingForm } from "./OnboardingForm";
import "./LoginPage.css";

export function OnboardingPage() {
  return (
    <LoginShell>
      <OnboardingForm />
    </LoginShell>
  );
}
