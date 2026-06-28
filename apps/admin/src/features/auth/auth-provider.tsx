import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";
import { ApiError, POLICY_ACCEPTANCE_REQUIRED_EVENT } from "@/lib/api";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/auth-token";
import {
  acceptPolicies as acceptPoliciesRequest,
  getMe,
  login as loginRequest,
  register as registerRequest,
} from "./auth.api";
import type {
  AcceptPoliciesResponse,
  LoginResponse,
  UserMembership,
  UserResponse,
} from "./auth.types";

type AuthContextValue = {
  user: UserResponse | null;
  memberships: UserMembership[];
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresPolicyAcceptance: boolean;
  login: (email: string, password: string) => Promise<LoginResponse>;
  register: (input: {
    email: string;
    name: string;
    password: string;
  }) => Promise<LoginResponse>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  acceptRequiredPolicies: (
    policyDocumentIds: string[],
  ) => Promise<AcceptPoliciesResponse>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresPolicyAcceptance, setRequiresPolicyAcceptance] = useState(false);

  const clearSessionState = useEffectEvent(() => {
    clearAccessToken();
    setUser(null);
    setMemberships([]);
    setRequiresPolicyAcceptance(false);
  });

  const applySessionState = useEffectEvent(
    (
      nextUser: UserResponse,
      nextRequiresPolicyAcceptance: boolean,
      nextMemberships: UserMembership[],
    ) => {
      setUser(nextUser);
      setRequiresPolicyAcceptance(nextRequiresPolicyAcceptance);
      setMemberships(nextMemberships);
    },
  );

  const markPolicyAcceptanceRequired = useEffectEvent(() => {
    if (!getAccessToken()) {
      return;
    }

    setRequiresPolicyAcceptance(true);
    setIsLoading(false);
  });

  const refreshMe = async () => {
    const accessToken = getAccessToken();

    if (!accessToken) {
      clearSessionState();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await getMe();
      applySessionState(
        response.user,
        response.requiresPolicyAcceptance,
        response.memberships,
      );
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        clearSessionState();
      } else {
        clearSessionState();
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshMe();
  }, []);

  useEffect(() => {
    const handlePolicyAcceptanceRequired = () => {
      markPolicyAcceptanceRequired();
    };

    window.addEventListener(
      POLICY_ACCEPTANCE_REQUIRED_EVENT,
      handlePolicyAcceptanceRequired,
    );

    return () => {
      window.removeEventListener(
        POLICY_ACCEPTANCE_REQUIRED_EVENT,
        handlePolicyAcceptanceRequired,
      );
    };
  }, [markPolicyAcceptanceRequired]);

  const login = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await loginRequest({
        email,
        password,
      });

      setAccessToken(response.accessToken);
      applySessionState(
        response.user,
        response.requiresPolicyAcceptance,
        response.memberships,
      );

      return response;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (input: {
    email: string;
    name: string;
    password: string;
  }) => {
    setIsLoading(true);

    try {
      const response = await registerRequest(input);

      setAccessToken(response.accessToken);
      applySessionState(
        response.user,
        response.requiresPolicyAcceptance,
        response.memberships,
      );

      return response;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearSessionState();
    setIsLoading(false);
  };

  const acceptRequiredPolicies = async (policyDocumentIds: string[]) => {
    setIsLoading(true);

    try {
      const response = await acceptPoliciesRequest(policyDocumentIds);
      const me = await getMe();

      applySessionState(
        me.user,
        me.requiresPolicyAcceptance,
        me.memberships,
      );

      return {
        ...response,
        requiresPolicyAcceptance: me.requiresPolicyAcceptance,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        memberships,
        isLoading,
        isAuthenticated: Boolean(user),
        requiresPolicyAcceptance,
        login,
        register,
        logout,
        refreshMe,
        acceptRequiredPolicies,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
