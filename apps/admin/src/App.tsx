import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/features/auth/auth-provider";
import { AppRouter } from "@/routes/app-router";

function App() {
  return (
    <AuthProvider>
      <AppRouter />
      <Toaster position="bottom-right" richColors closeButton />
    </AuthProvider>
  );
}

export default App;
