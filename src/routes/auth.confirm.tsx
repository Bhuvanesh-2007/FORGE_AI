import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export const Route = createFileRoute("/auth/confirm")({
  component: AuthConfirm,
});

function AuthConfirm() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const confirmEmail = async () => {
      try {
        const hash = window.location.hash;
        const accessToken = hash.includes("access_token")
          ? hash.split("access_token=")[1]?.split("&")[0]
          : null;

        if (!accessToken) {
          setStatus("error");
          setMessage("No confirmation token found in URL.");
          return;
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hash.includes("refresh_token")
            ? hash.split("refresh_token=")[1]?.split("&")[0]
            : "",
        });

        if (error) {
          setStatus("error");
          setMessage(error.message);
          return;
        }

        setStatus("success");
        setMessage("Email confirmed successfully!");
        
        setTimeout(() => {
          navigate({ to: "/dashboard" });
        }, 2000);
      } catch (err) {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Confirmation failed");
      }
    };

    confirmEmail();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-12 animate-spin text-violet" />
            <h2 className="text-xl font-semibold">Confirming your email...</h2>
          </div>
        )}
        
        {status === "success" && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle className="size-12 text-green-500" />
            <h2 className="text-xl font-semibold">{message}</h2>
            <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
          </div>
        )}
        
        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="size-12 text-red-500" />
            <h2 className="text-xl font-semibold">Confirmation Failed</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="mt-4 rounded-lg bg-gradient-brand px-6 py-2 text-sm font-medium text-primary-foreground"
            >
              Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
