import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { useSession, UserRole } from "@/context/SessionContext";
import { cleanMarkdown } from "@/utils/formatText";

function getApiBase() {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  imageUri?: string;
  streaming?: boolean;
}

interface TrendingQuestion {
  content: string;
  createdAt: string;
}

const ROLE_CONFIG: Record<
  UserRole,
  { label: string; color: string; bgColor: string; icon: string; greeting: string }
> = {
  learner: {
    label: "Learner",
    color: "#0ea5e9",
    bgColor: "#0c2340",
    icon: "book-open",
    greeting: (name: string, grade: string | null) =>
      `Hello ${name}! I am your personal SKAVS tutor. ${grade ? `As a Grade ${grade} learner, I` : "I"} will guide you step by step — not just give you the answer. What are you working on today?`,
  } as any,
  educator: {
    label: "Educator",
    color: "#10b981",
    bgColor: "#0c2620",
    icon: "briefcase",
    greeting: (name: string) =>
      `Welcome, ${name}. I am your SKAVS Lesson Architect. I can help you build lesson blueprints, pacing schedules, and intervention strategies. You may also share images or documents for analysis. What would you like to work on today?`,
  } as any,
  parent: {
    label: "Parent / Guardian",
    color: "#f59e0b",
    bgColor: "#251f0c",
    icon: "home",
    greeting: (name: string) =>
      `Hello ${name}! Welcome to SKAVS, your Hoye Secondary School information assistant. I can answer questions about registration, uniforms, fees, calendar dates, and much more. How can I help you today?`,
  } as any,
};

function getGreeting(role: UserRole, name: string, grade: string | null): string {
  const cfg = ROLE_CONFIG[role];
  if (role === "learner") return (cfg.greeting as any)(name, grade);
  return (cfg.greeting as any)(name);
}

function getConversationTitle(role: UserRole, name: string): string {
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${name} — ${role.charAt(0).toUpperCase() + role.slice(1)} — ${date}`;
}

const GRADES = ["8", "9", "10", "11", "12"];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { name, role, grade } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const [pendingImage, setPendingImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [showTrending, setShowTrending] = useState(false);
  const [trendingGrade, setTrendingGrade] = useState<string>("all");
  const [trendingQuestions, setTrendingQuestions] = useState<TrendingQuestion[]>([]);
  const [loadingTrending, setLoadingTrending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const userRole = (role ?? "parent") as UserRole;
  const cfg = ROLE_CONFIG[userRole];
  const roleColor = cfg.color;

  useEffect(() => {
    const init = async () => {
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/gemini/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: getConversationTitle(userRole, name),
            role: userRole,
            grade: grade ?? undefined,
          }),
        });
        const data = (await res.json()) as { id: number };
        setConversationId(data.id);
        setMessages([
          { id: "greeting", role: "assistant", content: getGreeting(userRole, name, grade) },
        ]);
      } catch {
        setMessages([
          { id: "greeting", role: "assistant", content: getGreeting(userRole, name, grade) },
        ]);
      } finally {
        setIsCreating(false);
      }
    };
    init();
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (cam.status !== "granted") return;
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: "images",
          quality: 0.6,
          base64: true,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          setPendingImage({
            uri: asset.uri,
            base64: asset.base64 ?? "",
            mimeType: asset.mimeType ?? "image/jpeg",
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setPendingImage({
          uri: asset.uri,
          base64: asset.base64 ?? "",
          mimeType: asset.mimeType ?? "image/jpeg",
        });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
  }, []);

  const loadTrending = useCallback(async (g: string) => {
    setLoadingTrending(true);
    try {
      const base = getApiBase();
      const gradeParam = g !== "all" ? `?grade=${g}` : "";
      const res = await fetch(`${base}/api/gemini/educator/trending${gradeParam}`, {
        headers: { "x-educator-password": process.env["EXPO_PUBLIC_EDUCATOR_PASSWORD"] ?? "Hoye2026" },
      });
      const data = (await res.json()) as TrendingQuestion[];
      setTrendingQuestions(Array.isArray(data) ? data : []);
    } catch {
      setTrendingQuestions([]);
    } finally {
      setLoadingTrending(false);
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if ((!text && !pendingImage) || isStreaming || !conversationId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const img = pendingImage;
    setInput("");
    setPendingImage(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text || "(Image shared)",
      imageUri: img?.uri,
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true };

    setMessages((prev) => [assistantMsg, userMsg, ...prev]);
    setIsStreaming(true);

    try {
      const base = getApiBase();
      const body: Record<string, string> = { content: text || "(Image shared)", userName: name };
      if (img) {
        body["imageBase64"] = img.base64;
        body["imageMimeType"] = img.mimeType;
      }

      const response = await fetch(
        `${base}/api/gemini/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      // Web platform stream support fallback
      if (Platform.OS === "web" && response.body && typeof response.body.getReader === "function") {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const json = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
                if (json.content) {
                  accumulated += json.content;
                  const captured = accumulated;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, content: captured, streaming: true } : m))
                  );
                }
                if (json.done || json.error) {
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m))
                  );
                }
              } catch {}
            }
          }
        }
      } else {
        // Safe, native mobile parsing solution for React Native (Hermes engine compatible)
        const responseText = await response.text();
        const lines = responseText.split("\n");
        let accumulated = "";

        for (const line of lines) {
          if (line.trim().startsWith("data: ")) {
            try {
              const rawJson = line.slice(6).trim();
              if (!rawJson) continue;

              const json = JSON.parse(rawJson) as {
                content?: string;
                done?: boolean;
                error?: string;
              };

              if (json.content) {
                accumulated += json.content;
                const captured = accumulated;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, content: captured, streaming: true } : m
                  )
                );
              }

              if (json.done || json.error) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, streaming: false } : m
                  )
                );
              }
            } catch (e) {
              // Gracefully handle incomplete or split JSON strings safely
            }
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Sorry ${name}, something went wrong. Please try again.`, streaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, pendingImage, isStreaming, conversationId, name]);

  const topPad = Platform.OS === "web" ? 56 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    const displayText = isUser ? item.content : cleanMarkdown(item.content);
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAssistant]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: roleColor + "22", borderColor: roleColor + "44" }]}>
            <Text style={[styles.avatarText, { color: roleColor }]}>S</Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser
              ? [styles.bubbleUser, { backgroundColor: colors.primary }]
              : [styles.bubbleAssistant, { backgroundColor: colors.surface, borderColor: colors.border }],
          ]}
        >
          {item.imageUri && (
            <Image
              source={{ uri: item.imageUri }}
              style={styles.bubbleImage}
              resizeMode="cover"
            />
          )}
          {!!displayText && (
            <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
              {displayText}
              {item.streaming && <Text style={{ color: roleColor }}>▌</Text>}
            </Text>
          )}
        </View>
      </View>
    );
  };

  if (isCreating) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={roleColor} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.roleChip, { backgroundColor: roleColor + "22", borderColor: roleColor + "44" }]}>
            <Feather name={cfg.icon as any} size={11} color={roleColor} />
            <Text style={[styles.roleChipText, { color: roleColor }]}>
              {cfg.label}{grade ? ` · Gr ${grade}` : ""}
            </Text>
          </View>
          <Text style={[styles.headerName, { color: colors.foreground }]}>{name}</Text>
        </View>
        <View style={styles.headerRight}>
          {userRole === "educator" && (
            <TouchableOpacity
              onPress={() => { setShowTrending(true); loadTrending(trendingGrade); }}
              style={[styles.iconBtn, { backgroundColor: roleColor + "18" }]}
              hitSlop={8}
            >
              <Feather name="trending-up" size={16} color={roleColor} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/(main)/resources"); }}
            style={[styles.iconBtn, { backgroundColor: roleColor + "18" }]}
            hitSlop={8}
          >
            <Feather name="book" size={16} color={roleColor} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.replace("/"); }}
            style={[styles.iconBtn, { backgroundColor: colors.surface }]}
            hitSlop={8}
          >
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={0}>
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={[styles.listContent, { paddingBottom: 12 }]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />

        {/* Image preview */}
        {pendingImage && (
          <View style={[styles.imagePreviewBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <Image source={{ uri: pendingImage.uri }} style={styles.imagePreview} resizeMode="cover" />
            <Text style={[styles.imagePreviewLabel, { color: colors.mutedForeground }]}>Image ready to send</Text>
            <TouchableOpacity onPress={() => setPendingImage(null)} hitSlop={8}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPad + 10 }]}>
          <TouchableOpacity
            onPress={pickImage}
            style={[styles.attachBtn, { backgroundColor: pendingImage ? roleColor + "22" : colors.surface, borderColor: pendingImage ? roleColor : colors.border }]}
            hitSlop={4}
          >
            <Feather name="image" size={18} color={pendingImage ? roleColor : colors.mutedForeground} />
          </TouchableOpacity>

          <TextInput
            style={[styles.textInput, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            placeholder={
              userRole === "learner"
                ? "Ask about a topic or problem..."
                : userRole === "educator"
                ? "Ask or share an image / document..."
                : "Ask about fees, uniform, registration..."
            }
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: (input.trim() || pendingImage) && !isStreaming ? roleColor : colors.surface }]}
            onPress={sendMessage}
            disabled={(!input.trim() && !pendingImage) || isStreaming}
            activeOpacity={0.8}
          >
            {isStreaming ? (
              <ActivityIndicator color={roleColor} size="small" />
            ) : (
              <Feather name="send" size={17} color={(input.trim() || pendingImage) ? "#fff" : colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Trending Modal (educator only) */}
      <Modal
        visible={showTrending}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTrending(false)}
      >
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Learner Trending Questions</Text>
            <TouchableOpacity onPress={() => setShowTrending(false)}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Grade filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gradeFilter} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
            {["all", ...GRADES].map((g) => {
              const isActive = trendingGrade === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.filterChip, { backgroundColor: isActive ? roleColor : colors.surface, borderColor: isActive ? roleColor : colors.border }]}
                  onPress={() => { setTrendingGrade(g); loadTrending(g); }}
                >
                  <Text style={[styles.filterChipText, { color: isActive ? "#fff" : colors.mutedForeground }]}>
                    {g === "all" ? "All Grades" : `Grade ${g}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingTrending ? (
            <View style={styles.trendingLoading}>
              <ActivityIndicator color={roleColor} />
              <Text style={[styles.trendingEmpty, { color: colors.mutedForeground }]}>Loading questions...</Text>
            </View>
          ) : trendingQuestions.length === 0 ? (
            <View style={styles.trendingLoading}>
              <Feather name="inbox" size={32} color={colors.mutedForeground} />
              <Text style={[styles.trendingEmpty, { color: colors.mutedForeground }]}>No learner questions yet for this grade.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {trendingQuestions.map((q, i) => (
                <View key={i} style={[styles.trendingItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.trendingNum, { backgroundColor: roleColor + "22" }]}>
                    <Text style={[styles.trendingNumText, { color: roleColor }]}>{i + 1}</Text>
                  </View>
                  <Text style={[styles.trendingText, { color: colors.foreground }]} numberOfLines={4}>
                    {q.content}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerLeft: { gap: 3 },
  headerName: { fontSize: 16, fontWeight: "600" },
  headerRight: { flexDirection: "row", gap: 8 },
  roleChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start",
  },
  roleChipText: { fontSize: 11, fontWeight: "600" },
  iconBtn: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  listContent: { paddingHorizontal: 14, paddingTop: 10, gap: 10 },
  msgRow: { flexDirection: "row", gap: 8, maxWidth: "88%" },
  msgRowUser: { alignSelf: "flex-end" },
  msgRowAssistant: { alignSelf: "flex-start" },
  avatar: {
    width: 28, height: 28, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2,
  },
  avatarText: { fontSize: 12, fontWeight: "700" },
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 10, flexShrink: 1, overflow: "hidden" },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleImage: { width: "100%", height: 180, borderRadius: 10, marginBottom: 8 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  imagePreviewBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1,
  },
  imagePreview: { width: 48, height: 48, borderRadius: 8 },
  imagePreviewLabel: { flex: 1, fontSize: 13 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end", gap: 8,
    paddingHorizontal: 14, paddingTop: 10, borderTopWidth: 1,
  },
  attachBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center",
    justifyinit Content: "center", borderWidth: 1, flexShrink: 0,
  },
  textInput: {
    flex: 1, borderWidth: 1, borderRadius: 18, paddingHorizontal: 14,
    paddingVertical: 10, fontSize: 15, maxHeight: 110,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center",
    justifyContent: "center", flexShrink: 0,
  },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  gradeFilter: { flexShrink: 0 },
  filterChip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  filterChipText: { fontSize: 13, fontWeight: "600" },
  trendingLoading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  trendingEmpty: { fontSize: 14, textAlign: "center" },
  trendingItem: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    borderRadius: 12, borderWidth: 1, padding: 12,
  },
  trendingNum: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  trendingNumText: { fontSize: 13, fontWeight: "700" },
  trendingText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
