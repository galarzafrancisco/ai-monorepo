import React from "react";
import { useSession } from "../context/SessionContext";

export default function Home() {
  const { session } = useSession();
  if (!session) return null;

  return (
    <React.Fragment>
      <section className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="">
          <h1 className="text-4xl font-bold mb-6">Home</h1>
          <div>
            Hey <strong>{session.user.displayName}</strong>, welcome to the MCP Portal!
          </div>
        </div>
      </section>
    </React.Fragment>
  );
}
