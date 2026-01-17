import { useEffect } from "react";
import { useHomeCtx } from "./home-context";

export function HomePage() {
  console.log('Home page mounting');
  const { message, setSectionTitle, sectionTitle } = useHomeCtx();

  useEffect(() => {
    console.log('Home page useEffect hook triggered');
    console.log('setting section title');
    setSectionTitle('Home sweet home');
  }, [setSectionTitle]);

  return (
    <div>
      <p>hardcoded content</p>
      <p>{message}</p>
      <p>section title via hook: {sectionTitle}</p>
    </div>
  )
}
