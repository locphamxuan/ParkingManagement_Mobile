import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    setError(null);

    if (!fullName.trim()) { setError('Full name is required.'); return; }
    if (!email.trim()) { setError('Email is required.'); return; }
    if (!password.trim()) { setError('Password is required.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }

    try {
      setLoading(true);
      await register(fullName.trim(), email.trim().toLowerCase(), password, phone.trim() || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f8fafc' }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Form Section */}
          <View style={{ paddingHorizontal: 24, paddingTop: 30, paddingBottom: 20, gap: 20 }}>
            {/* Back button */}
            <TouchableOpacity onPress={() => router.back()} style={{ alignSelf: 'flex-start', paddingVertical: 4 }}>
              <Text style={{ color: '#0ea5e9', fontSize: 14, fontWeight: '700' }}>← Back</Text>
            </TouchableOpacity>

            <Text style={{ fontSize: 26, fontWeight: '900', color: '#0f172a', textAlign: 'center', marginBottom: 4 }}>Register</Text>

            <View style={{ gap: 14 }}>
              <Input
                label="Full Name"
                placeholder="Nguyen Van A"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
              />
              <Input
                label="Email"
                placeholder="you@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Input
                label="Phone (optional)"
                placeholder="0901234567"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="Password"
                placeholder="At least 6 characters"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Input
                label="Confirm Password"
                placeholder="Repeat password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <ErrorBanner message={error} hideIcon />

            <Button
              label="Create Account"
              onPress={handleRegister}
              loading={loading}
              fullWidth
              size="lg"
              style={{ marginTop: 6 }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 12 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
              <Text style={{ marginHorizontal: 12, fontSize: 11, fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase' }}>or register with social platforms</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#e2e8f0' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16 }}>
              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <Ionicons name="logo-google" size={20} color="#ea4335" />
              </TouchableOpacity>
              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <Ionicons name="logo-facebook" size={20} color="#1877f2" />
              </TouchableOpacity>
              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <Ionicons name="logo-github" size={20} color="#24292e" />
              </TouchableOpacity>
              <TouchableOpacity style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
                <Ionicons name="logo-linkedin" size={20} color="#0a66c2" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bottom Curved Card */}
          <View style={{
            backgroundColor: '#0369a1', // Sky-700 deep royal cyan-blue
            borderTopLeftRadius: 80,
            borderTopRightRadius: 80,
            paddingTop: 40,
            paddingBottom: 50,
            paddingHorizontal: 24,
            alignItems: 'center',
            marginTop: 'auto',
            shadowColor: '#0369a1',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.25,
            shadowRadius: 10,
            elevation: 6,
          }}>
            <Text style={{ fontSize: 24, fontWeight: '900', color: '#ffffff', letterSpacing: 0.5 }}>Welcome Back!</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: 'rgba(255, 255, 255, 0.75)', marginTop: 4 }}>Already have an Account?</Text>
            <TouchableOpacity
              onPress={() => router.push('/(auth)/login')}
              style={{
                marginTop: 14,
                borderWidth: 1.5,
                borderColor: '#ffffff',
                borderRadius: 20,
                paddingHorizontal: 24,
                paddingVertical: 8,
              }}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
