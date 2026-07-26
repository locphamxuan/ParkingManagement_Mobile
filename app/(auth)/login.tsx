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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/authStore";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";
import { ErrorBanner } from "../../components/ui/ErrorBanner";
import { BrandMark } from "../../components/ui/BrandMark";
import { GradientView } from "../../components/ui/GradientView";
import { Gradients } from "../../constants/theme";
import { useFocusedStatusBarStyle } from "../../hooks/useFocusedStatusBarStyle";
import { styles } from "../../styles/screens/login";

const SOCIAL_PROVIDERS = [
  { name: "logo-google", color: "#ea4335", label: "Google" },
  { name: "logo-facebook", color: "#1877f2", label: "Facebook" },
  { name: "logo-github", color: "#24292e", label: "GitHub" },
  { name: "logo-linkedin", color: "#0a66c2", label: "LinkedIn" },
] as const;

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login } = useAuthStore();

  useFocusedStatusBarStyle("light");

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
    <SafeAreaView style={styles.safe} edges={["bottom", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <GradientView
            colors={Gradients.header}
            direction="diagonal"
            style={[styles.hero, { paddingTop: insets.top + 24 }]}
          >
            <View style={styles.heroRow}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroTitle} accessibilityRole="header">Hello, Welcome</Text>
                <Text style={styles.heroSub}>Don&apos;t have an account?</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/(auth)/register")}
                style={styles.heroCta}
                accessibilityRole="button"
                accessibilityLabel="Create an account"
              >
                <Text style={styles.heroCtaText}>Register</Text>
              </TouchableOpacity>
            </View>
          </GradientView>

          <View style={styles.form}>
            <View style={styles.brand}>
              <BrandMark size={60} />
              <Text style={styles.title}>Login</Text>
            </View>

            <View style={styles.fields}>
              <Input
                label="Email"
                icon="mail-outline"
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
              <Input
                label="Password"
                icon="lock-closed-outline"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              onPress={() => router.push("/(auth)/forgot-password")}
              style={styles.forgotLink}
              accessibilityRole="button"
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <ErrorBanner message={error} />

            <Button
              label="Login"
              onPress={handleLogin}
              loading={loading}
              fullWidth
              size="lg"
              style={styles.submitBtn}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or login with social platforms</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              {SOCIAL_PROVIDERS.map((provider) => (
                <TouchableOpacity
                  key={provider.label}
                  style={styles.socialBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Continue with ${provider.label}`}
                >
                  <Ionicons name={provider.name} size={22} color={provider.color} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
