import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Text, Button, Surface, HelperText } from 'react-native-paper';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { TextInput } from 'react-native-paper';
import { useAuth } from '../providers/AuthProvider';

export default function LoginScreen() {
  const theme = useTheme();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) newErrors.email = "L'email est requis";
    else if (!email.includes('@')) newErrors.email = 'Email invalide';
    if (!password.trim()) newErrors.password = 'Le mot de passe est requis';
    else if (password.length < 4) newErrors.password = 'Mot de passe trop court';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    const success = await login(email.trim(), password);
    if (!success) {
      Alert.alert('Connexion échouée', 'Email ou mot de passe incorrect. Vérifiez vos identifiants.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo & Brand */}
        <View style={styles.brandSection}>
          <Surface style={styles.logoSurface} elevation={4}>
            <Icon name="cog-transfer" size={48} color="#6366f1" />
          </Surface>
          <Text variant="displaySmall" style={styles.brandName}>
            Maintrix
          </Text>
          <Text variant="bodyMedium" style={[styles.brandSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Supervision industrielle adaptative
          </Text>
        </View>

        {/* Login Card */}
        <Surface style={styles.card} elevation={3}>
          <Text variant="headlineSmall" style={styles.cardTitle}>
            Connexion
          </Text>
          <Text variant="bodySmall" style={[styles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Connectez-vous à votre compte Maintrix
          </Text>

          <View style={styles.fields}>
            <TextInput
              label="Email"
              value={email}
              onChangeText={(t) => { setEmail(t); setErrors((e) => ({ ...e, email: undefined })); }}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              left={<TextInput.Icon icon="email-outline" />}
              error={!!errors.email}
              style={styles.input}
            />
            {errors.email && <HelperText type="error">{errors.email}</HelperText>}

            <TextInput
              label="Mot de passe"
              value={password}
              onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: undefined })); }}
              mode="outlined"
              secureTextEntry={!showPassword}
              left={<TextInput.Icon icon="lock-outline" />}
              right={
                <TextInput.Icon
                  icon={showPassword ? 'eye-off' : 'eye'}
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              error={!!errors.password}
              style={styles.input}
              onSubmitEditing={handleLogin}
              returnKeyType="done"
            />
            {errors.password && <HelperText type="error">{errors.password}</HelperText>}
          </View>

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            style={[styles.loginBtn, { backgroundColor: '#6366f1' }]}
            contentStyle={styles.loginBtnContent}
            icon="login"
          >
            Se connecter
          </Button>

          <Button
            mode="text"
            onPress={() => Alert.alert('Réinitialisation', 'Rendez-vous sur le portail web Maintrix pour réinitialiser votre mot de passe.')}
            style={styles.forgotBtn}
            compact
          >
            Mot de passe oublié ?
          </Button>
        </Surface>

        {/* Features preview */}
        <View style={styles.features}>
          {[
            { icon: 'brain', label: 'Diagnostic IA' },
            { icon: 'qrcode-scan', label: 'Scanner QR' },
            { icon: 'wifi-off', label: 'Mode offline' },
          ].map((f) => (
            <View key={f.icon} style={styles.featureItem}>
              <Icon name={f.icon} size={24} color="#6366f1" />
              <Text variant="labelSmall" style={[styles.featureLabel, { color: theme.colors.onSurfaceVariant }]}>
                {f.label}
              </Text>
            </View>
          ))}
        </View>

        <Text variant="bodySmall" style={[styles.version, { color: theme.colors.onSurfaceVariant }]}>
          Maintrix Mobile v2.0.0
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  brandSection: { alignItems: 'center', marginBottom: 32 },
  logoSurface: {
    width: 88,
    height: 88,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#ede9fe',
  },
  brandName: {
    fontWeight: 'bold',
    color: '#6366f1',
    letterSpacing: -1,
  },
  brandSubtitle: { marginTop: 4 },
  card: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  cardTitle: { fontWeight: 'bold', marginBottom: 4 },
  cardSubtitle: { marginBottom: 24 },
  fields: { gap: 8, marginBottom: 8 },
  input: { borderRadius: 8 },
  loginBtn: { borderRadius: 12, marginTop: 8 },
  loginBtnContent: { paddingVertical: 6 },
  forgotBtn: { marginTop: 8, alignSelf: 'center' },
  features: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  featureItem: { alignItems: 'center', gap: 6 },
  featureLabel: { textAlign: 'center' },
  version: { textAlign: 'center' },
});
