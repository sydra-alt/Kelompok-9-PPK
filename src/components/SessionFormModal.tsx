import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppColors, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import type { Lab, PracticeClass, PracticeSession } from '@/types';

interface SessionFormModalProps {
  visible: boolean;
  classes: PracticeClass[];
  labs: Lab[];
  initialData?: PracticeSession | null;
  defaultAssistantName?: string;
  onClose: () => void;
  onSubmit: (data: {
    classId: string;
    labId: string;
    labName: string;
    className: string;
    practicalName: string;
    date: string;
    startTime: string;
    endTime: string;
    topic?: string;
    room?: string;
    assistantName?: string;
  }) => Promise<void>;
}

export function SessionFormModal({
  visible,
  classes,
  labs,
  initialData,
  defaultAssistantName,
  onClose,
  onSubmit,
}: SessionFormModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <SessionFormContent
          key={initialData?.id ?? 'new-session'}
          classes={classes}
          labs={labs}
          initialData={initialData}
          defaultAssistantName={defaultAssistantName}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </View>
    </Modal>
  );
}

function SessionFormContent({
  classes,
  labs,
  initialData,
  defaultAssistantName,
  onClose,
  onSubmit,
}: {
  classes: PracticeClass[];
  labs: Lab[];
  initialData?: PracticeSession | null;
  defaultAssistantName?: string;
  onClose: () => void;
  onSubmit: (data: {
    classId: string;
    labId: string;
    labName: string;
    className: string;
    practicalName: string;
    date: string;
    startTime: string;
    endTime: string;
    topic?: string;
    room?: string;
    assistantName?: string;
  }) => Promise<void>;
}) {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayDate = `${yyyy}-${mm}-${dd}`;

  const [selectedClassId, setSelectedClassId] = useState(
    initialData?.classId ?? classes[0]?.id ?? '',
  );
  const [preferredLabId, setPreferredLabId] = useState(initialData?.labId ?? labs[0]?.id ?? '');
  const selectedLabId = labs.some((lab) => lab.id === preferredLabId)
    ? preferredLabId
    : labs[0]?.id ?? '';
  const [date, setDate] = useState(initialData?.date ?? todayDate);
  const [startTime, setStartTime] = useState(initialData?.startTime ?? '08:00');
  const [endTime, setEndTime] = useState(initialData?.endTime ?? '10:00');
  const [topic, setTopic] = useState(initialData?.topic ?? '');
  const [room, setRoom] = useState(initialData?.room ?? '');
  const [assistantName, setAssistantName] = useState(
    initialData?.assistantName ?? defaultAssistantName ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    const selectedLab = labs.find((lab) => lab.id === selectedLabId);
    if (!selectedClass && !initialData) {
      setError('Pilih kelas praktikum terlebih dahulu.');
      return;
    }
    if (!selectedLab) {
      setError('Pilih lokasi presensi yang tersedia di Firebase terlebih dahulu.');
      return;
    }

    const trimmedDate = date.trim();
    const trimmedStart = startTime.trim();
    const trimmedEnd = endTime.trim();

    if (!trimmedDate) {
      setError('Tanggal praktikum wajib diisi (YYYY-MM-DD).');
      return;
    }
    if (!trimmedStart || !trimmedEnd) {
      setError('Waktu mulai dan selesai wajib diisi (HH:mm).');
      return;
    }
    if (trimmedStart >= trimmedEnd) {
      setError('Waktu mulai harus lebih awal daripada waktu selesai.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        classId: selectedClass?.id ?? initialData?.classId ?? '',
        labId: selectedLab.id,
        labName: selectedLab.name,
        className: selectedClass?.name ?? initialData?.className ?? '',
        practicalName: selectedClass?.practicalName ?? initialData?.practicalName ?? 'Praktikum',
        date: trimmedDate,
        startTime: trimmedStart,
        endTime: trimmedEnd,
        topic: topic.trim() || undefined,
        room: room.trim() || undefined,
        assistantName: assistantName.trim() || defaultAssistantName,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan sesi praktikum.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.keyboardView}>
      <View style={styles.card} accessibilityViewIsModal>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>
            {initialData ? 'Ubah Sesi Praktikum' : 'Tambah Sesi Praktikum'}
          </Text>
          <Text style={styles.subtitle}>
            {initialData
              ? 'Perbarui jadwal, waktu, atau lokasi pertemuan praktikum.'
              : 'Jadwalkan sesi pertemuan praktikum baru untuk praktikan.'}
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {!initialData ? (
            <View style={styles.field}>
              <Text style={styles.label}>Pilih Kelas untuk Sesi</Text>
              {classes.length === 0 ? (
                <Text style={styles.noClassesWarning}>
                  Belum ada kelas. Buat kelas terlebih dahulu.
                </Text>
              ) : (
                <View style={styles.chipRow}>
                  {classes.map((c) => {
                    const selected = c.id === selectedClassId;
                    return (
                      <Pressable
                        key={c.id}
                        testID={`session-class-option-${c.id}`}
                        onPress={() => setSelectedClassId(c.id)}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        style={[styles.chip, selected && styles.chipSelected]}>
                        <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                          {c.name} — {c.practicalName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>Lokasi Presensi</Text>
            <Text style={styles.fieldHint}>
              Lokasi dan radius diambil dari dokumen laboratorium di Firebase.
            </Text>
            {labs.length === 0 ? (
              <Text style={styles.noClassesWarning}>
                Lokasi valid belum tersedia. Periksa koleksi `labs` dan aturan Firestore.
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {labs.map((lab) => {
                  const selected = lab.id === selectedLabId;
                  return (
                    <Pressable
                      key={lab.id}
                      testID={`session-lab-option-${lab.id}`}
                      onPress={() => setPreferredLabId(lab.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {lab.name}{lab.building ? ` · ${lab.building}` : ''} · radius {lab.radiusMeters} m
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tanggal (YYYY-MM-DD)</Text>
            <TextInput
              value={date}
              editable={!submitting}
              onChangeText={(text) => {
                setDate(text);
                setError(null);
              }}
              placeholder="2026-10-21"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Waktu Mulai (HH:mm)</Text>
              <TextInput
                value={startTime}
                editable={!submitting}
                onChangeText={(text) => {
                  setStartTime(text);
                  setError(null);
                }}
                placeholder="08:00"
                placeholderTextColor={AppColors.textMuted}
                style={styles.input}
              />
            </View>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Waktu Selesai (HH:mm)</Text>
              <TextInput
                value={endTime}
                editable={!submitting}
                onChangeText={(text) => {
                  setEndTime(text);
                  setError(null);
                }}
                placeholder="10:00"
                placeholderTextColor={AppColors.textMuted}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Topik / Materi</Text>
            <TextInput
              value={topic}
              editable={!submitting}
              onChangeText={setTopic}
              placeholder="Contoh: Layouting Flexbox & Grid"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Ruangan / Nomor Ruang (Opsional)</Text>
            <TextInput
              value={room}
              editable={!submitting}
              onChangeText={setRoom}
              placeholder="Contoh: Ruang 2"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Nama Asisten Pengampu</Text>
            <TextInput
              value={assistantName}
              editable={!submitting}
              onChangeText={setAssistantName}
              placeholder="Nama asisten yang bertugas"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={submitting}
              style={styles.cancelButton}
              accessibilityRole="button">
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
            <AppButton
              title={submitting ? 'Menyimpan...' : 'Simpan Sesi'}
              onPress={() => void handleSubmit()}
              disabled={
                submitting ||
                labs.length === 0 ||
                !selectedLabId ||
                (!initialData && classes.length === 0)
              }
              style={styles.submitButton}
            />
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
    backgroundColor: AppColors.overlay,
  },
  keyboardView: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
  },
  card: {
    width: '100%',
    padding: Spacing.four,
    borderRadius: Radius.xl,
    backgroundColor: AppColors.surface,
  },
  scroll: {
    gap: Spacing.three,
  },
  title: {
    color: AppColors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  subtitle: {
    color: AppColors.textMuted,
    fontSize: 13,
    marginTop: -Spacing.one,
  },
  errorText: {
    color: AppColors.danger,
    fontSize: 13,
    backgroundColor: AppColors.dangerSoft,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  noClassesWarning: {
    color: AppColors.warning,
    fontSize: 13,
    fontStyle: 'italic',
  },
  fieldHint: {
    color: AppColors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    color: AppColors.text,
    backgroundColor: AppColors.background,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.background,
  },
  chipSelected: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.text,
  },
  chipTextSelected: {
    color: AppColors.textOnPrimary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  cancelButton: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  cancelText: {
    color: AppColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
  },
});
