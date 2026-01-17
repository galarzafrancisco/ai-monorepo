import { useEffect } from "react";
import { useWikirooCtx } from "./wikiroo-context";

export function WikirooHome(): JSX.Element {
  const { setSectionTitle } = useWikirooCtx();

  console.log('WikirooHome rendered');

  // Set page title
  useEffect(() => {
    setSectionTitle("Home");
  }, [setSectionTitle]);

  return (
    <div>
      <h1>Welcome to Wikiroo Home</h1>
      <h1>Welcome to Wikiroo Home</h1>
      <h1>Welcome to Wikiroo Home</h1>
      <h1>Welcome to Wikiroo Home</h1>
      <h1>Welcome to Wikiroo Home</h1>
      <h1>Welcome to Wikiroo Home</h1>
      <h1>Welcome to Wikiroo Home</h1>
      <h1>Welcome to Wikiroo Home</h1>
      <h1>Welcome to Wikiroo Home</h1>
    </div>
  );
}
