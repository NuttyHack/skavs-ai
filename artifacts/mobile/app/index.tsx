import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useSession, UserRole } from "@/context/SessionContext";

const ROLES: { key: UserRole; label: string; description: string; icon: string }[] = [
  { key: "learner", label: "Learner", description: "Personal AI tutor & Socratic coach", icon: "🧑‍🎓" },
  { key: "educator", label: "Educator", description: "Lesson architect & planning assistant", icon: "👩‍🏫" },
  { key: "parent", label: "Parent / Guardian", description: "Instant school info officer", icon: "👪" },
];

export default function GateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setSession } = useSession();
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function handleContinue() {
    if (!name.trim() || !selectedRole) {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSession(name.trim(), selectedRole);
    router.replace("/(main)/chat");
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <LinearGradient
      colors={["#060d1f", "#0b1224", "#0f1a33"]}
      style={[styles.gradient, { paddingTop: topPad }]}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: colors.primary + "22", borderColor: colors.primary + "44" }]}>
              <Text style={[styles.badgeText, { color: colors.primary }]}>SKAVS</Text>
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Welcome to SKAVS
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              System-Wide Knowledge & Academic{"\n"}Virtual Specialist
            </Text>
            <Text style={[styles.school, { color: colors.mutedForeground }]}>
              Hoye Secondary School
            </Text>
          </View>

          <Animated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
            <Text style={[styles.label, { color: colors.surfaceForeground }]}>Your name</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Enter your name..."
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
            />

            <Text style={[styles.label, { color: colors.surfaceForeground, marginTop: 24 }]}>
              I am a...
            </Text>
            <View style={styles.roles}>
              {ROLES.map((r) => {
                const isSelected = selectedRole === r.key;
                const roleColor =
                  r.key === "learner"
                    ? colors.learner
                    : r.key === "educator"
                    ? colors.educator
                    : colors.parent;
                const roleBg =
                  r.key === "learner"
                    ? colors.learnerBg
                    : r.key === "educator"
                    ? colors.educatorBg
                    : colors.parentBg;

                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: isSelected ? roleBg : colors.surface,
                        borderColor: isSelected ? roleColor : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedRole(r.key);
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.roleIcon}>{r.icon}</Text>
                    <View style={styles.roleText}>
                      <Text style={[styles.roleLabel, { color: isSelected ? roleColor : colors.foreground }]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.roleDesc, { color: colors.mutedForeground }]}>
                        {r.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <View style={[styles.dot, { backgroundColor: roleColor }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>

          <TouchableOpacity
            style={[
              styles.btn,
              { backgroundColor: name.trim() && selectedRole ? colors.primary : colors.surface },
            ]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnText, { color: name.trim() && selectedRole ? "#fff" : colors.mutedForeground }]}>
              Enter SKAVS
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  flex: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
    justifyContent: "center",
  },
  header: { alignItems: "center", marginBottom: 36 },
  badge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  badgeText: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 3 },
  title: { fontSize: 28, fontWeight: "700" as const, textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 4 },
  school: { fontSize: 12, textAlign: "center" },
  form: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600" as const, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  roles: { gap: 10 },
  roleCard: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  roleIcon: { fontSize: 24 },
  roleText: { flex: 1 },
  roleLabel: { fontSize: 15, fontWeight: "600" as const, marginBottom: 2 },
  roleDesc: { fontSize: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  btn: {
    marginTop: 32,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  btnText: { fontSize: 16, fontWeight: "700" as const },
});
