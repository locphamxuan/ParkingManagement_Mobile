import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password.trim()) {
      setError("Password is required.");
      return;
    }

    try {
      setLoading(true);
      await login(email.trim().toLowerCase(), password);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Login failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Curved Card */}
          <View style={{
            backgroundColor: "#0369a1", // Sky-700 deep royal cyan-blue
            borderBottomLeftRadius: 80,
            borderBottomRightRadius: 80,
            paddingTop: 50,
            paddingBottom: 40,
            paddingHorizontal: 24,
            alignItems: "center",
            shadowColor: "#0369a1",
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 6,
          }}>
            <Text style={{ fontSize: 24, fontWeight: "900", color: "#ffffff", letterSpacing: 0.5 }}>Hello, Welcome</Text>
            <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255, 255, 255, 0.75)", marginTop: 4 }}>Don't have an Account?</Text>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/register")}
              style={{
                marginTop: 14,
                borderWidth: 1.5,
                borderColor: "#ffffff",
                borderRadius: 20,
                paddingHorizontal: 24,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: "#ffffff", fontWeight: "800", fontSize: 12 }}>Register</Text>
            </TouchableOpacity>
          </View>

          {/* Bottom Form Section */}
          <View style={{ paddingHorizontal: 24, paddingVertical: 32, gap: 20, flex: 1, justifyContent: "center" }}>
            <Text style={{ fontSize: 26, fontWeight: "900", color: "#0f172a", textAlign: "center", marginBottom: 4 }}>Login</Text>

            <View style={{ gap: 16 }}>
              <Input
                label="Email"
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Password"
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              style={{ alignSelf: "flex-end", marginTop: -6 }}
            >
              <Text style={{ color: "#0ea5e9", fontSize: 12, fontWeight: "700" }}>Forgot password?</Text>
            </TouchableOpacity>

            <ErrorBanner message={error} hideIcon />

            <Button
              label="Login"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
              style={{ marginTop: 6 }}
            />

            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
              <Text style={{ marginHorizontal: 12, fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>or login with social platforms</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "#e2e8f0" }} />
            </View>

            <View style={{ flexDirection: "row", justifyContent: "center", gap: 16 }}>
              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <Ionicons name="logo-google" size={20} color="#ea4335" />
              </TouchableOpacity>
              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <Ionicons name="logo-facebook" size={20} color="#1877f2" />
              </TouchableOpacity>
              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <Ionicons name="logo-github" size={20} color="#24292e" />
              </TouchableOpacity>
              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: "#cbd5e1", backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <Ionicons name="logo-linkedin" size={20} color="#0a66c2" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
