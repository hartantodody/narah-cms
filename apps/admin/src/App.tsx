import { AuthProvider } from "@/features/auth/auth-provider";
import { AppRouter } from "@/routes/app-router";

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;
