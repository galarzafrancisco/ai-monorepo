import { useEffect } from "react";
import { Card } from "../../ui/primitives";
import { useHomeCtx } from "./HomeProvider";

function Content(): JSX.Element {
  return (
    <div>
      <div>
        {'111111111'.split('').map((c, i) => (
          <Card key={i}>
            <div>
              Habia una vez un hombre que vivia en un pueblo muy lejano. Cada dia, se levantaba temprano para trabajar en los campos y cuidar de sus animales. A pesar de las dificultades, siempre mantenia una actitud positiva y trabajaba duro para mejorar su vida y la de su familia.
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function HomePage() {
  console.log('Home Page');
  const { setSectionTitle } = useHomeCtx();
  
  useEffect(() => {
    console.log('setting section title')
    setSectionTitle('Home sweet home')
  }, []);

  return (
    <div>
      <Content />
    </div>
  )
}