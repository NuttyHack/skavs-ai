import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";
import { fetch } from "expo/fetch";
import { useColors } from "@/hooks/useColors";
import { useSession } from "@/context/SessionContext";

function getApiBase() {
  const domain = process.env["EXPO_PUBLIC_DOMAIN"];
  return domain ? `https://${domain}` : "";
}

// ─── Curated Past Paper Sources ───────────────────────────────────────────────

const PAST_PAPERS = [
  {
    subject: "Physical Sciences",
    icon: "zap" as const,
    color: "#ef4444",
    sources: [
      { name: "Stanmore Physics", desc: "Full paper packs, memos, video solutions", url: "https://www.stanmorephysics.com/physical-sciences/" },
      { name: "DBE Official Papers", desc: "NSC past papers + memos — all years", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
      { name: "Best Education", desc: "Sorted by year and paper number", url: "https://www.besteducation.co.za/physical-sciences/" },
    ],
  },
  {
    subject: "Pure Mathematics",
    icon: "grid" as const,
    color: "#3b82f6",
    sources: [
      { name: "Stanmore Maths", desc: "Paper 1 & 2 packs + worked solutions", url: "https://www.stanmorephysics.com/mathematics/" },
      { name: "DBE Official Papers", desc: "NSC past papers + memos — all years", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
      { name: "Maths4Africa", desc: "Grade 10–12 practice papers and memos", url: "https://www.maths4africa.co.za/products/past-papers/" },
    ],
  },
  {
    subject: "Mathematical Literacy",
    icon: "bar-chart-2" as const,
    color: "#8b5cf6",
    sources: [
      { name: "DBE Official Papers", desc: "NSC past papers + memos — all years", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
      { name: "Best Education", desc: "Sorted by year and paper number", url: "https://www.besteducation.co.za/mathematical-literacy/" },
    ],
  },
  {
    subject: "Life Sciences",
    icon: "activity" as const,
    color: "#10b981",
    sources: [
      { name: "Stanmore Life Sciences", desc: "Papers, memos, and diagrams", url: "https://www.stanmorephysics.com/life-sciences/" },
      { name: "DBE Official Papers", desc: "NSC past papers + memos — all years", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
      { name: "Best Education", desc: "Life Sciences paper bundles", url: "https://www.besteducation.co.za/life-sciences/" },
    ],
  },
  {
    subject: "English FAL",
    icon: "book-open" as const,
    color: "#ec4899",
    sources: [
      { name: "DBE Official Papers", desc: "Paper 1, 2, 3 + memos — all years", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
      { name: "Best Education", desc: "English FAL paper bundles", url: "https://www.besteducation.co.za/english-first-additional-language/" },
    ],
  },
  {
    subject: "Geography",
    icon: "map" as const,
    color: "#f59e0b",
    sources: [
      { name: "DBE Official Papers", desc: "NSC past papers + memos — all years", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
      { name: "Best Education", desc: "Geography paper bundles", url: "https://www.besteducation.co.za/geography/" },
    ],
  },
  {
    subject: "Business Studies",
    icon: "briefcase" as const,
    color: "#0ea5e9",
    sources: [
      { name: "DBE Official Papers", desc: "NSC past papers + memos — all years", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
      { name: "Best Education", desc: "Business Studies paper bundles", url: "https://www.besteducation.co.za/business-studies/" },
    ],
  },
  {
    subject: "Accounting",
    icon: "dollar-sign" as const,
    color: "#14b8a6",
    sources: [
      { name: "Stanmore Accounting", desc: "Financial statements, ratios, VAT packs", url: "https://www.stanmorephysics.com/accounting/" },
      { name: "DBE Official Papers", desc: "NSC past papers + memos — all years", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
    ],
  },
  {
    subject: "History",
    icon: "clock" as const,
    color: "#a78bfa",
    sources: [
      { name: "DBE Official Papers", desc: "Source + essay papers with memos", url: "https://www.education.gov.za/Curriculum/NationalSeniorCertificate(NSC)Examinations/NSCPastExaminationPapers.aspx" },
      { name: "Best Education", desc: "History paper bundles", url: "https://www.besteducation.co.za/history/" },
    ],
  },
];

const SUBJECTS = [
  "English FAL", "IsiZulu HL", "Life Orientation",
  "Pure Mathematics", "Mathematical Literacy",
  "Physical Sciences", "Life Sciences",
  "Business Studies", "Accounting", "Geography", "History",
  "Creative Arts", "Technology", "EMS", "Social Sciences", "General",
];

const GRADES = ["All Grades", "8", "9", "10", "11", "12"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResourceItem {
  id: number;
  title: string;
  subject: string;
  grade: string | null;
  mimeType: string;
  fileName: string | null;
  uploadedBy: string;
  description: string | null;
  createdAt: string;
}

interface ResourceFull extends ResourceItem {
  fileData: string;
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function ResourcesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { role, name, educatorAuthenticated } = useSession();
  const isEducator = role === "educator" && educatorAuthenticated;

  const [activeTab, setActiveTab] = useState<"papers" | "resources">("papers");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [classResources, setClassResources] = useState<ResourceItem[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [filterGrade, setFilterGrade] = useState("All Grades");
  const [filterSubject, setFilterSubject] = useState("All");
  const [viewingResource, setViewingResource] = useState<ResourceFull | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const topPad = Platform.OS === "web" ? 56 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const loadResources = useCallback(async () => {
    setLoadingResources(true);
    try {
      const base = getApiBase();
      const params = new URLSearchParams();
      if (filterGrade !== "All Grades") params.set("grade", filterGrade);
      if (filterSubject !== "All") params.set("subject", filterSubject);
      const res = await fetch(`${base}/api/gemini/resources?${params.toString()}`);
      const data = (await res.json()) as ResourceItem[];
      setClassResources(Array.isArray(data) ? data : []);
    } catch {
      setClassResources([]);
    } finally {
      setLoadingResources(false);
    }
  }, [filterGrade, filterSubject]);

  useEffect(() => {
    if (activeTab === "resources") loadResources();
  }, [activeTab, filterGrade, filterSubject, loadResources]);

  async function openLink(url: string) {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.AUTOMATIC });
  }

  async function viewResource(id: number) {
    try {
      const base = getApiBase();
      const res = await fetch(`${base}/api/gemini/resources/${id}`);
      const data = (await res.json()) as ResourceFull;
      setViewingResource(data);
    } catch {}
  }

  async function deleteResource(id: number) {
    try {
      const base = getApiBase();
      await fetch(`${base}/api/gemini/educator/resources/${id}`, {
        method: "DELETE",
        headers: { "x-educator-password": process.env["EXPO_PUBLIC_EDUCATOR_PASSWORD"] ?? "Hoye2026" },
      });
      await loadResources();
    } catch {}
  }

  const toggle = (subject: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(subject) ? next.delete(subject) : next.add(subject);
      return next;
    });
    Haptics.selectionAsync();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Resources</Text>
        {isEducator ? (
          <TouchableOpacity
            onPress={() => setShowUpload(true)}
            style={[styles.uploadBtn, { backgroundColor: "#10b98122", borderColor: "#10b98144" }]}
          >
            <Feather name="upload" size={14} color="#10b981" />
            <Text style={[styles.uploadBtnText, { color: "#10b981" }]}>Upload</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 72 }} />
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(["papers", "resources"] as const).map((tab) => {
          const label = tab === "papers" ? "Past Papers" : "Class Resources";
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, { color: isActive ? "#2563eb" : colors.mutedForeground }]}>
                {label}
              </Text>
              {isActive && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {activeTab === "papers" ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionNote, { color: colors.mutedForeground }]}>
            Tap any source to open it in your browser. All links are free and official.
          </Text>
          {PAST_PAPERS.map((item) => {
            const isOpen = expanded.has(item.subject);
            return (
              <View key={item.subject} style={[styles.subjectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.subjectHeader}
                  onPress={() => toggle(item.subject)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.subjectIcon, { backgroundColor: item.color + "22" }]}>
                    <Feather name={item.icon} size={16} color={item.color} />
                  </View>
                  <Text style={[styles.subjectTitle, { color: colors.foreground }]}>{item.subject}</Text>
                  <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
                {isOpen && (
                  <View style={[styles.sourceList, { borderTopColor: colors.border }]}>
                    {item.sources.map((s) => (
                      <TouchableOpacity
                        key={s.name}
                        style={[styles.sourceRow, { borderBottomColor: colors.border }]}
                        onPress={() => openLink(s.url)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.sourceInfo}>
                          <Text style={[styles.sourceName, { color: colors.foreground }]}>{s.name}</Text>
                          <Text style={[styles.sourceDesc, { color: colors.mutedForeground }]}>{s.desc}</Text>
                        </View>
                        <Feather name="external-link" size={14} color={item.color} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={styles.flex}>
          {/* Filters */}
          <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
              {GRADES.map((g) => {
                const isActive = filterGrade === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[styles.chip, { backgroundColor: isActive ? "#2563eb" : colors.surface, borderColor: isActive ? "#2563eb" : colors.border }]}
                    onPress={() => setFilterGrade(g)}
                  >
                    <Text style={[styles.chipText, { color: isActive ? "#fff" : colors.mutedForeground }]}>{g === "All Grades" ? "All" : `Gr ${g}`}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {loadingResources ? (
            <View style={styles.center}>
              <ActivityIndicator color="#2563eb" size="large" />
            </View>
          ) : classResources.length === 0 ? (
            <View style={styles.center}>
              <Feather name="inbox" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No resources yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.mutedForeground }]}>
                {isEducator ? "Tap Upload to share homework or an activity with learners." : "Your educator has not uploaded any resources yet."}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 24 }]} showsVerticalScrollIndicator={false}>
              {classResources.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.resourceCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => viewResource(r.id)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.resourceIcon, { backgroundColor: r.mimeType.startsWith("image") ? "#0ea5e922" : "#f59e0b22" }]}>
                    <Feather name={r.mimeType.startsWith("image") ? "image" : "file-text"} size={18} color={r.mimeType.startsWith("image") ? "#0ea5e9" : "#f59e0b"} />
                  </View>
                  <View style={styles.resourceInfo}>
                    <Text style={[styles.resourceTitle, { color: colors.foreground }]} numberOfLines={2}>{r.title}</Text>
                    <View style={styles.resourceMeta}>
                      {r.grade && (
                        <View style={[styles.badge, { backgroundColor: "#2563eb22" }]}>
                          <Text style={[styles.badgeText, { color: "#2563eb" }]}>Gr {r.grade}</Text>
                        </View>
                      )}
                      <View style={[styles.badge, { backgroundColor: colors.card }]}>
                        <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{r.subject}</Text>
                      </View>
                    </View>
                    <Text style={[styles.resourceUploadedBy, { color: colors.mutedForeground }]}>
                      Uploaded by {r.uploadedBy}
                    </Text>
                  </View>
                  <View style={styles.resourceActions}>
                    <Feather name="eye" size={16} color={colors.mutedForeground} />
                    {isEducator && (
                      <TouchableOpacity onPress={() => deleteResource(r.id)} hitSlop={8} style={{ marginTop: 8 }}>
                        <Feather name="trash-2" size={15} color="#ef4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* View Resource Modal */}
      <Modal visible={!!viewingResource} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setViewingResource(null)}>
        {viewingResource && (
          <ViewResourceModal
            resource={viewingResource}
            colors={colors}
            onClose={() => setViewingResource(null)}
            bottomPad={bottomPad}
          />
        )}
      </Modal>

      {/* Upload Resource Modal */}
      <Modal visible={showUpload} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowUpload(false)}>
        <UploadResourceModal
          colors={colors}
          educatorName={name}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); setActiveTab("resources"); loadResources(); }}
          bottomPad={bottomPad}
        />
      </Modal>
    </View>
  );
}

// ─── View Resource Modal ──────────────────────────────────────────────────────

function ViewResourceModal({ resource, colors, onClose, bottomPad }: {
  resource: ResourceFull;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onClose: () => void;
  bottomPad: number;
}) {
  const isImage = resource.mimeType.startsWith("image");
  return (
    <View style={[styles.modal, { backgroundColor: colors.background }]}>
      <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.modalTitle, { color: colors.foreground }]} numberOfLines={2}>{resource.title}</Text>
        <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
      </View>
      <View style={[styles.modalMeta, { borderBottomColor: colors.border }]}>
        {resource.grade && (
          <View style={[styles.badge, { backgroundColor: "#2563eb22" }]}>
            <Text style={[styles.badgeText, { color: "#2563eb" }]}>Grade {resource.grade}</Text>
          </View>
        )}
        <View style={[styles.badge, { backgroundColor: colors.surface }]}>
          <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>{resource.subject}</Text>
        </View>
        <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>By {resource.uploadedBy}</Text>
      </View>
      {resource.description ? (
        <Text style={[styles.modalDesc, { color: colors.mutedForeground, borderBottomColor: colors.border }]}>{resource.description}</Text>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomPad + 16 }}>
        {isImage ? (
          <Image
            source={{ uri: `data:${resource.mimeType};base64,${resource.fileData}` }}
            style={styles.viewImage}
            resizeMode="contain"
          />
        ) : (
          <Text style={[styles.textContent, { color: colors.foreground }]}>{resource.fileData}</Text>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Upload Resource Modal ────────────────────────────────────────────────────

function UploadResourceModal({ colors, educatorName, onClose, onUploaded, bottomPad }: {
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  educatorName: string;
  onClose: () => void;
  onUploaded: () => void;
  bottomPad: number;
}) {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("General");
  const [grade, setGrade] = useState("All Grades");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState<"image" | "text">("text");
  const [textContent, setTextContent] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState("image/jpeg");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [subjectOpen, setSubjectOpen] = useState(false);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", quality: 0.7, base64: true });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setImageUri(a.uri);
      setImageBase64(a.base64 ?? "");
      setImageMimeType(a.mimeType ?? "image/jpeg");
    }
  }

  async function handleUpload() {
    if (!title.trim()) { setError("Please enter a title."); return; }
    if (contentType === "image" && !imageBase64) { setError("Please select an image."); return; }
    if (contentType === "text" && !textContent.trim()) { setError("Please enter the activity text."); return; }

    setUploading(true); setError("");
    try {
      const base = getApiBase();
      const body = {
        title: title.trim(),
        subject,
        grade: grade === "All Grades" ? null : grade,
        description: description.trim() || null,
        mimeType: contentType === "image" ? imageMimeType : "text/plain",
        fileName: contentType === "image" ? "resource.jpg" : null,
        fileData: contentType === "image" ? imageBase64 : textContent.trim(),
        uploadedBy: educatorName,
      };
      const res = await fetch(`${base}/api/gemini/educator/resources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-educator-password": process.env["EXPO_PUBLIC_EDUCATOR_PASSWORD"] ?? "Hoye2026",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) { setError("Upload failed. Please try again."); return; }
      onUploaded();
    } catch {
      setError("Upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <View style={[styles.modal, { backgroundColor: colors.background }]}>
      <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
        <Text style={[styles.modalTitle, { color: colors.foreground }]}>Upload Resource</Text>
        <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={colors.mutedForeground} /></TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: bottomPad + 24 }} keyboardShouldPersistTaps="handled">

        {/* Title */}
        <View>
          <Text style={[styles.label, { color: colors.surfaceForeground }]}>Title</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border }]}
            placeholder="e.g. Grade 10 Algebra Homework"
            placeholderTextColor={colors.mutedForeground}
            value={title} onChangeText={setTitle}
          />
        </View>

        {/* Subject */}
        <View>
          <Text style={[styles.label, { color: colors.surfaceForeground }]}>Subject</Text>
          <TouchableOpacity
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}
            onPress={() => setSubjectOpen(!subjectOpen)}
          >
            <Text style={{ color: colors.foreground, fontSize: 15 }}>{subject}</Text>
            <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
          </TouchableOpacity>
          {subjectOpen && (
            <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {SUBJECTS.map((s) => (
                <TouchableOpacity key={s} style={styles.dropdownItem} onPress={() => { setSubject(s); setSubjectOpen(false); }}>
                  <Text style={[styles.dropdownText, { color: s === subject ? "#2563eb" : colors.foreground }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Grade */}
        <View>
          <Text style={[styles.label, { color: colors.surfaceForeground }]}>Grade</Text>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {GRADES.map((g) => {
              const isActive = grade === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, { backgroundColor: isActive ? "#2563eb" : colors.surface, borderColor: isActive ? "#2563eb" : colors.border }]}
                  onPress={() => setGrade(g)}
                >
                  <Text style={[styles.chipText, { color: isActive ? "#fff" : colors.mutedForeground }]}>{g === "All Grades" ? "All" : `Gr ${g}`}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Description */}
        <View>
          <Text style={[styles.label, { color: colors.surfaceForeground }]}>Description (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border, height: 68, textAlignVertical: "top" }]}
            placeholder="Brief note about this resource..."
            placeholderTextColor={colors.mutedForeground}
            value={description} onChangeText={setDescription} multiline
          />
        </View>

        {/* Content type toggle */}
        <View>
          <Text style={[styles.label, { color: colors.surfaceForeground }]}>Content type</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["text", "image"] as const).map((t) => {
              const isActive = contentType === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, { flex: 1, justifyContent: "center", backgroundColor: isActive ? "#10b981" : colors.surface, borderColor: isActive ? "#10b981" : colors.border }]}
                  onPress={() => setContentType(t)}
                >
                  <Text style={[styles.chipText, { color: isActive ? "#fff" : colors.mutedForeground }]}>
                    {t === "text" ? "Text / Activity" : "Image / Scan"}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {contentType === "text" ? (
          <View>
            <Text style={[styles.label, { color: colors.surfaceForeground }]}>Activity content</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.foreground, borderColor: colors.border, minHeight: 140, textAlignVertical: "top" }]}
              placeholder="Paste or type the homework / activity here. You can also copy from a SKAVS-generated activity..."
              placeholderTextColor={colors.mutedForeground}
              value={textContent} onChangeText={setTextContent} multiline
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.imagePicker, { backgroundColor: colors.surface, borderColor: imageUri ? "#10b981" : colors.border }]}
            onPress={pickImage}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.imagePickerPreview} resizeMode="cover" />
            ) : (
              <>
                <Feather name="image" size={28} color={colors.mutedForeground} />
                <Text style={[styles.imagePickerText, { color: colors.mutedForeground }]}>Tap to select an image</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.uploadSubmitBtn, { backgroundColor: uploading ? colors.surface : "#10b981" }]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? <ActivityIndicator color="#10b981" /> : (
            <>
              <Feather name="upload" size={16} color="#fff" />
              <Text style={styles.uploadSubmitText}>Share with Learners</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" as const },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  uploadBtnText: { fontSize: 12, fontWeight: "600" as const },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, position: "relative" },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: "600" as const },
  tabUnderline: { position: "absolute", bottom: 0, left: "15%", right: "15%", height: 2, backgroundColor: "#2563eb", borderRadius: 2 },
  content: { padding: 14, gap: 10 },
  sectionNote: { fontSize: 12, marginBottom: 6, textAlign: "center" },
  subjectCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  subjectHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  subjectIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  subjectTitle: { flex: 1, fontSize: 15, fontWeight: "600" as const },
  sourceList: { borderTopWidth: 1 },
  sourceRow: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  sourceInfo: { flex: 1 },
  sourceName: { fontSize: 14, fontWeight: "600" as const, marginBottom: 2 },
  sourceDesc: { fontSize: 12 },
  filterBar: { borderBottomWidth: 1 },
  chip: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, alignItems: "center" },
  chipText: { fontSize: 12, fontWeight: "600" as const },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  emptyTitle: { fontSize: 16, fontWeight: "600" as const },
  emptyDesc: { fontSize: 13, textAlign: "center", lineHeight: 19 },
  resourceCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    borderRadius: 14, borderWidth: 1, padding: 13,
  },
  resourceIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  resourceInfo: { flex: 1, gap: 5 },
  resourceTitle: { fontSize: 14, fontWeight: "600" as const, lineHeight: 19 },
  resourceMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: "600" as const },
  resourceUploadedBy: { fontSize: 11 },
  resourceActions: { alignItems: "center", gap: 4 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 16, fontWeight: "700" as const, flex: 1, marginRight: 12 },
  modalMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap", padding: 14, borderBottomWidth: 1, alignItems: "center" },
  modalDesc: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  viewImage: { width: "100%", height: 400, borderRadius: 12 },
  textContent: { fontSize: 15, lineHeight: 24 },
  label: { fontSize: 11, fontWeight: "600" as const, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  dropdown: {
    borderWidth: 1, borderRadius: 12, marginTop: 4,
    maxHeight: 200, overflow: "hidden",
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 0.5 },
  dropdownText: { fontSize: 14 },
  imagePicker: {
    borderWidth: 1.5, borderRadius: 12, borderStyle: "dashed",
    height: 130, alignItems: "center", justifyContent: "center", gap: 8, overflow: "hidden",
  },
  imagePickerPreview: { width: "100%", height: "100%" },
  imagePickerText: { fontSize: 13 },
  errorText: { color: "#ef4444", fontSize: 13 },
  uploadSubmitBtn: { borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  uploadSubmitText: { color: "#fff", fontSize: 15, fontWeight: "700" as const },
});
