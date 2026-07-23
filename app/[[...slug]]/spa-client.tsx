"use client";

import { useEffect, useState } from "react";

type SiteComponent = React.ComponentType;

export function SpaClient() {
  const [Site, setSite] = useState<SiteComponent | null>(null);

  useEffect(() => {
    let active = true;
    import("../../src/app/App").then(({ default: App }) => {
      if (active) setSite(() => App);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!Site) {
    return (
      <main
        aria-label="Loading Manoir Kits"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#080808",
          color: "#fff",
          fontFamily: "Georgia, serif",
          letterSpacing: "0.18em",
        }}
      >
        MANOIR KITS
      </main>
    );
  }

  return <Site />;
}
