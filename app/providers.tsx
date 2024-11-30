"use client";
import { Connect } from "@stacks/connect-react";
import { AppConfig, UserSession } from "@stacks/connect";
import { useEffect, useState } from "react";

const appConfig = new AppConfig(["store_write", "publish_data"]);
const userSession = new UserSession({ appConfig });

export function Providers({ children }: { children: React.ReactNode }) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!origin) return null;

  return (
    <Connect
      authOptions={{
        appDetails: {
          name: "Token Deployer",
          icon: `${origin}/logo.png`,
        },
        userSession,
        onFinish: () => {
          window.location.reload();
        },
        onCancel: () => {
          console.log("Cancelled connect");
        },
      }}
    >
      {children}
    </Connect>
  );
}
