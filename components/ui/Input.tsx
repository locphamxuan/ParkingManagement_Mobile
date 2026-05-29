import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  type KeyboardTypeOptions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Colors, FontSize, Radius } from '../../constants/theme';

interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (t: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  error?: string;
  editable?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  hint?: string;
  autoCorrect?: boolean;
}

export function Input({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  editable = true,
  multiline = false,
  numberOfLines,
  style,
  inputStyle,
  hint,
  autoCorrect = false,
}: InputProps) {
  const [visible, setVisible] = useState(false);
  const isSecure = secureTextEntry && !visible;

  return (
    <View style={[styles.wrapper, style]}>
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.inputRow,
          !editable && styles.disabled,
          error ? styles.inputError : null,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textDim}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoCorrect={autoCorrect}
          style={[
            styles.input,
            multiline && { height: (numberOfLines ?? 3) * 22, textAlignVertical: 'top', paddingTop: 12 },
            inputStyle,
          ]}
        />
        {secureTextEntry ? (
          <TouchableOpacity onPress={() => setVisible((v) => !v)} style={styles.eyeBtn}>
            <Text style={styles.eyeText}>{visible ? '🙈' : '👁'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    color: Colors.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  disabled: { opacity: 0.5 },
  inputError: { borderColor: Colors.errorBorder },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.base,
    paddingVertical: 0,
  },
  eyeBtn: { paddingLeft: 8, paddingVertical: 4 },
  eyeText: { fontSize: 16 },
  error: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '600',
  },
  hint: {
    fontSize: FontSize.xs,
    color: Colors.textDim,
    fontWeight: '500',
  },
});
