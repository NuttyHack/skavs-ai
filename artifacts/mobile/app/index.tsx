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
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { useSession, UserRole } from "@/context/SessionContext";

function getApiBase() {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

const ROLES: {
  key: UserRole;
  label: string;
  description: string;
  icon: string;
  color: string;
}[] = [
  {
    key: "learner",
    label: "Learner",
    description: "Personal AI tutor & Socratic coach",
    icon: "book-open",
    color: "#0ea5e9",
  },
  {
    key: "educator",
    label: "Educator",
    description: "Lesson architect — password required",
    icon: "briefcase",
    color: "#10b981",
  },
  {
    key: "parent",
    label: "Parent / Guardian",
    description: "Instant school info officer",
    icon: "home",
    color: "#f59e0b",
  },
];

const GRADES = ["8", "9", "10", "11", "12"];

export default function GateScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setSession, setEducatorAuthenticated } = useSession();
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  const [educatorPassword, setEducatorPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  async function handleContinue() {
    if (!name.trim() || !selectedRole) {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    if (selectedRole === "learner" && !selectedGrade) {
      shake();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (selectedRole === "educator") {
      if (!educatorPassword.trim()) {
        shake();
        setPasswordError("Please enter the educator password.");
        return;
      }
      setVerifying(true);
      setPasswordError("");
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/gemini/educator/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: educatorPassword }),
        });
        const data = await res.json() as { ok: boolean; error?: string };
        if (!data.ok) {
          setPasswordError("Incorrect password. Please try again.");
          shake();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          setVerifying(false);
          return;
        }
        setEducatorAuthenticated(true);
      } catch {
        setPasswordError("Could not verify. Check your connection.");
        setVerifying(false);
        return;
      }
      setVerifying(false);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSession(name.trim(), selectedRole, selectedRole === "learner" ? (selectedGrade ?? undefined) : undefined);
    router.replace("/(main)/chat");
  }

  const topPad = Platform.OS === "web" ? 56 : insets.top;
  const canProceed =
    !!name.trim() &&
    !!selectedRole &&
    (selectedRole !== "learner" || !!selectedGrade) &&
    (selectedRole !== "educator" || !!educatorPassword.trim());

  return (
    <LinearGradient colors={["#060d1f", "#0b1224", "#0f1a33"]} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[styles.inner, { transform: [{ translateX: shakeAnim }] }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: "#2563eb22", borderColor: "#2563eb44" }]}>
              <Text style={[styles.badgeText, { color: "#2563eb" }]}>SKAVS</Text>
            </View>
            <Text style={styles.title}>Welcome to SKAVS</Text>
            <Text style={styles.subtitle}>Hoye Secondary School{"\n"}Smart Knowledge & Virtual Support</Text>
          </View>

          {/* Name */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.surfaceForeground }]}>Your full name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
              placeholder="Enter your name..."
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>

          {/* Role */}
          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.surfaceForeground }]}>I am a...</Text>
            <View style={styles.roles}>
              {ROLES.map((r) => {
                const isSelected = selectedRole === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[
                      styles.roleCard,
                      {
                        backgroundColor: isSelected ? r.color + "18" : colors.surface,
                        borderColor: isSelected ? r.color : colors.border,
                      },
                    ]}
                    onPress={() => {
                      setSelectedRole(r.key);
                      setPasswordError("");
                      Haptics.selectionAsync();
                    }}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.roleIcon, { backgroundColor: r.color + "22" }]}>
                      <Feather name={r.icon as any} size={18} color={r.color} />
                    </View>
                    <View style={styles.roleText}>
                      <Text style={[styles.roleLabel, { color: isSelected ? r.color : colors.foreground }]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.roleDesc, { color: colors.mutedForeground }]}>
                        {r.description}
                      </Text>
                    </View>
                    {isSelected && (
                      <Feather name="check-circle" size={16} color={r.color} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Grade picker — only for learners */}
          {selectedRole === "learner" && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.surfaceForeground }]}>My grade</Text>
              <View style={styles.grades}>
                {GRADES.map((g) => {
                  const isSelected = selectedGrade === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.gradeBtn,
                        {
                          backgroundColor: isSelected ? "#0ea5e9" : colors.surface,
                          borderColor: isSelected ? "#0ea5e9" : colors.border,
                        },
                      ]}
                      onPress={() => {
                        setSelectedGrade(g);
                        Haptics.selectionAsync();
                      }}
                    >
                      <Text style={[styles.gradeBtnText, { color: isSelected ? "#fff" : colors.mutedForeground }]}>
                        Gr {g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Password — only for educators */}
          {selectedRole === "educator" && (
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.surfaceForeground }]}>Educator password</Text>
              <View style={[styles.input, { backgroundColor: colors.surface, borderColor: passwordError ? "#ef4444" : colors.border, paddingHorizontal: 0, paddingVertical: 0, flexDirection: "row", alignItems: "center" }]}>
                <TextInput
                  style={[{ flex: 1, color: colors.foreground, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 }]}
                  placeholder="Enter educator password..."
                  placeholderTextColor={colors.mutedForeground}
                  value={educatorPassword}
                  onChangeText={(t) => { setEducatorPassword(t); setPasswordError(""); }}
                  secureTextEntry
                  returnKeyType="done"
                />
                <Feather name="lock" size={16} color={colors.mutedForeground} style={{ marginRight: 14 }} />
              </View>
              {!!passwordError && (
                <Text style={styles.errorText}>{passwordError}</Text>
              )}
            </View>
          )}

          {/* Continue button */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: canProceed ? "#2563eb" : colors.surface, opacity: verifying ? 0.7 : 1 }]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={verifying}
          >
            {verifying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.btnText, { color: canProceed ? "#fff" : colors.mutedForeground }]}>
                Enter SKAVS
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { flexGrow: 1 },
  inner: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 32 },
  badge: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 14 },
  badgeText: { fontSize: 12, fontWeight: "700" as const, letterSpacing: 3 },
  title: { fontSize: 26, fontWeight: "700" as const, color: "#e8eaf0", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 13, color: "#64748b", textAlign: "center", lineHeight: 18 },
  section: { marginBottom: 22 },
  label: { fontSize: 12, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15 },
  roles: { gap: 10 },
  roleCard: {
    borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  roleIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  roleText: { flex: 1 },
  roleLabel: { fontSize: 15, fontWeight: "600" as const, marginBottom: 2 },
  roleDesc: { fontSize: 12 },
  grades: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  gradeBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10 },
  gradeBtnText: { fontSize: 14, fontWeight: "600" as const },
  errorText: { color: "#ef4444", fontSize: 12, marginTop: 6 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  btnText: { fontSize: 16, fontWeight: "700" as const },
});
