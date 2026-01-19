import { useEffect } from "react";
import { useContextCtx } from "./ContextProvider";

export function ContextHome(): JSX.Element {
  const { setSectionTitle } = useContextCtx();

  console.log('ContextHome rendered');

  // Set page title
  useEffect(() => {
    setSectionTitle("Home");
  }, []);

  return (
    <div>
      <h1>Welcome to Context Home</h1>
      <h1>Welcome to Context Home</h1>
      <h1>Welcome to Context Home</h1>
      <h1>Welcome to Context Home</h1>
      <h1>Welcome to Context Home</h1>
      <h1>Welcome to Context Home</h1>
      <h1>Welcome to Context Home</h1>
      <h1>Welcome to Context Home</h1>
      <h1>Welcome to Context Home</h1>
    </div>
  );
}