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
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { useSession, UserRole } from "@/context/SessionContext";

function getApiBase(): string {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
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
    greeting:
      "Hello! I'm your personal AI tutor. I'll guide you through concepts using questions and hints — not just answers. What are you working on today?",
  },
  educator: {
    label: "Educator",
    color: "#10b981",
    bgColor: "#0c2620",
    icon: "briefcase",
    greeting:
      "Welcome, Educator. I'm your Lesson Architect. I can help you build 45-minute lesson blueprints, create pacing schedules, or deconstruct curriculum material. What would you like to work on?",
  },
  parent: {
    label: "Parent/Guardian",
    color: "#f59e0b",
    bgColor: "#251f0c",
    icon: "home",
    greeting:
      "Hello! I'm your school information assistant for Hoye Secondary School. I can answer questions about registration, uniforms, fees, calendar dates, and more. How can I help you today?",
  },
};

function getConversationTitle(role: UserRole, name: string): string {
  const now = new Date();
  const date = now.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${name} — ${role.charAt(0).toUpperCase() + role.slice(1)} — ${date}`;
}

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { name, role, clearSession } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const userRole = (role ?? "parent") as UserRole;
  const cfg = ROLE_CONFIG[userRole];

  const roleColor = cfg.color;

  useEffect(() => {
    const initConversation = async () => {
      try {
        const base = getApiBase();
        const res = await fetch(`${base}/api/gemini/conversations`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: getConversationTitle(userRole, name),
            role: userRole,
          }),
        });
        const data = await res.json() as { id: number };
        setConversationId(data.id);
        setMessages([
          {
            id: "greeting",
            role: "assistant",
            content: cfg.greeting,
          },
        ]);
      } catch {
        setMessages([
          {
            id: "greeting",
            role: "assistant",
            content: cfg.greeting,
          },
        ]);
      } finally {
        setIsCreating(false);
      }
    };
    initConversation();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !conversationId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [assistantMsg, userMsg, ...prev]);
    setIsStreaming(true);

    try {
      const base = getApiBase();
      const response = await fetch(
        `${base}/api/gemini/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text }),
        }
      );

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const json = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
              if (json.content) {
                accumulated += json.content;
                const captured = accumulated;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: captured, streaming: true }
                      : m
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
            } catch {}
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again.", streaming: false }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, conversationId]);

  function handleNewChat() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/");
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const renderItem = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
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
          <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
            {item.content}
            {item.streaming && <Text style={{ color: roleColor }}>▌</Text>}
          </Text>
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
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.roleChip, { backgroundColor: roleColor + "22", borderColor: roleColor + "44" }]}>
            <Feather name={cfg.icon as any} size={12} color={roleColor} />
            <Text style={[styles.roleChipText, { color: roleColor }]}>{cfg.label}</Text>
          </View>
          <Text style={[styles.headerName, { color: colors.foreground }]}>{name}</Text>
        </View>
        <TouchableOpacity onPress={handleNewChat} style={styles.newBtn} hitSlop={12}>
          <Feather name="refresh-cw" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          inverted
          contentContainerStyle={[styles.listContent, { paddingBottom: 16 }]}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!messages.length}
        />

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: bottomPad + 12,
            },
          ]}
        >
          <TextInput
            style={[
              styles.textInput,
              { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border },
            ]}
            placeholder={
              userRole === "learner"
                ? "Ask about a concept or topic..."
                : userRole === "educator"
                ? "Describe what you need help with..."
                : "Ask about school info, fees, dates..."
            }
            placeholderTextColor={colors.mutedForeground}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={2000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              { backgroundColor: input.trim() && !isStreaming ? roleColor : colors.surface },
            ]}
            onPress={sendMessage}
            disabled={!input.trim() || isStreaming}
            activeOpacity={0.8}
          >
            {isStreaming ? (
              <ActivityIndicator color={roleColor} size="small" />
            ) : (
              <Feather name="send" size={18} color={input.trim() ? "#fff" : colors.mutedForeground} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerLeft: { gap: 4 },
  headerName: { fontSize: 17, fontWeight: "600" as const },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  roleChipText: { fontSize: 11, fontWeight: "600" as const },
  newBtn: { padding: 4 },
  listContent: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  msgRow: { flexDirection: "row", gap: 8, maxWidth: "85%" },
  msgRowUser: { alignSelf: "flex-end" },
  msgRowAssistant: { alignSelf: "flex-start" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  avatarText: { fontSize: 12, fontWeight: "700" as const },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, flexShrink: 1 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
