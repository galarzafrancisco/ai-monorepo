import { Routes, Route } from "react-router-dom";
import { ConsentPage } from "./ConsentPage";
import { ConsentLayout } from "./ConsentLayout";
import { ConsentProvider } from "./ConsentProvider";

export function ConsentRoutes() {
  return (
    <ConsentProvider>
      <Routes>
        <Route element={<ConsentLayout />}>
          <Route path="/" element={<ConsentPage />} />
        </Route>
      </Routes>
    </ConsentProvider>
  );
}
