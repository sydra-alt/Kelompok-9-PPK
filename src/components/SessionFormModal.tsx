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
import { getJakartaNowParts, isSessionStartAllowed } from '@/utils/session-time';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_OPTIONS = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateFromKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function formatDateLabel(value: string): string {
  return dateFromKey(value).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export interface SessionFormValues {
  classId: string;
  className: string;
  practicalName: string;
  labId: string;
  labName: string;
  date: string;
  startTime: string;
  endTime: string;
  topic?: string;
  room?: string;
  assistantName?: string;
}

interface SessionFormModalProps {
  visible: boolean;
  classes: PracticeClass[];
  labs: Lab[];
  initialData?: PracticeSession | null;
  defaultAssistantName?: string;
  onClose: () => void;
  onSubmit: (data: SessionFormValues) => Promise<void>;
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
  onSubmit: (data: SessionFormValues) => Promise<void>;
}) {
  const todayDate = getJakartaNowParts().date;
  const isCreating = !initialData;

  const [selectedClassId, setSelectedClassId] = useState(
    initialData?.classId ?? classes[0]?.id ?? '',
  );
  const [preferredLabId, setPreferredLabId] = useState(initialData?.labId ?? labs[0]?.id ?? '');
  const selectedLabId = labs.some((lab) => lab.id === preferredLabId)
    ? preferredLabId
    : labs[0]?.id ?? '';
  const initialLab = labs.find((l) => l.id === selectedLabId);
  const [date, setDate] = useState(initialData?.date ?? todayDate);
  const initialStart = initialData?.startTime ?? TIME_OPTIONS.find((option) => option >= getJakartaNowParts().time && option < '23:45') ?? '08:00';
  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialData?.endTime ?? TIME_OPTIONS.find((option) => option > initialStart) ?? '');
  const [activePicker, setActivePicker] = useState<'date' | 'start' | 'end' | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const selected = dateFromKey(initialData?.date ?? todayDate);
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });
  const [topic, setTopic] = useState(initialData?.topic ?? '');
  const [room, setRoom] = useState(initialData?.room ?? initialLab?.name ?? '');
  const [assistantName, setAssistantName] = useState(
    initialData?.assistantName ?? defaultAssistantName ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSelectLab = (nextLab: Lab) => {
    const previousLab = labs.find((l) => l.id === selectedLabId);
    setPreferredLabId(nextLab.id);
    setError(null);
    if (!room.trim() || (previousLab && room.trim() === previousLab.name)) {
      setRoom(nextLab.name);
    }
  };

  const chooseDate = (nextDate: Date) => {
    const nextDateKey = dateKey(nextDate);
    setDate(nextDateKey);
    setError(null);
    setActivePicker(null);
    if (isCreating && nextDateKey === todayDate) {
      const minimumStart = TIME_OPTIONS.find((option) => option >= getJakartaNowParts().time && option < '23:45');
      if (minimumStart && startTime < minimumStart) {
        setStartTime(minimumStart);
        const nextEnd = TIME_OPTIONS.find((option) => option > minimumStart);
        if (nextEnd) setEndTime(nextEnd);
      }
    }
  };

  const chooseTime = (target: 'start' | 'end', value: string) => {
    if (target === 'start') {
      setStartTime(value);
      if (endTime <= value) {
        const nextEnd = TIME_OPTIONS.find((option) => option > value);
        setEndTime(nextEnd ?? '');
      }
    } else {
      setEndTime(value);
    }
    setError(null);
    setActivePicker(null);
  };

  const isTimeOptionDisabled = (target: 'start' | 'end', option: string) =>
    (target === 'start' && option === '23:45') ||
    (isCreating && date === todayDate && option < getJakartaNowParts().time) ||
    (target === 'end' && option <= startTime);

  const handleSubmit = async () => {
    const selectedClass = classes.find((c) => c.id === selectedClassId);
    if (!selectedClass && !initialData) {
      setError('Pilih kelas praktikum terlebih dahulu.');
      return;
    }

    const selectedLab = labs.find((lab) => lab.id === selectedLabId);
    if (!selectedLab) {
      setError('Pilih laboratorium pelaksanaan praktikum terlebih dahulu.');
      return;
    }

    const trimmedDate = date.trim();
    const trimmedStart = startTime.trim();
    const trimmedEnd = endTime.trim();

    if (!trimmedDate || !DATE_PATTERN.test(trimmedDate)) {
      setError('Tanggal praktikum wajib diisi dengan format YYYY-MM-DD.');
      return;
    }
    if (!trimmedStart || !TIME_PATTERN.test(trimmedStart)) {
      setError('Waktu mulai wajib diisi dengan format HH:mm (mis. 08:00).');
      return;
    }
    if (!trimmedEnd || !TIME_PATTERN.test(trimmedEnd)) {
      setError('Waktu selesai wajib diisi dengan format HH:mm (mis. 10:00).');
      return;
    }
    if (trimmedStart >= trimmedEnd) {
      setError('Waktu mulai harus lebih awal daripada waktu selesai.');
      return;
    }
    if (isCreating && !isSessionStartAllowed(trimmedDate, trimmedStart)) {
      setError('Untuk sesi baru, tanggal dan waktu mulai harus sekarang atau setelahnya.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        classId: selectedClass?.id ?? initialData?.classId ?? '',
        className: selectedClass?.name ?? initialData?.className ?? '',
        practicalName: selectedClass?.practicalName ?? initialData?.practicalName ?? 'Praktikum',
        labId: selectedLab.id,
        labName: selectedLab.name,
        date: trimmedDate,
        startTime: trimmedStart,
        endTime: trimmedEnd,
        topic: topic.trim() || undefined,
        room: room.trim() || selectedLab.name,
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
            <Text style={styles.label}>Pilih Laboratorium (Wajib untuk Presensi Lokasi)</Text>
            <Text style={styles.fieldHint}>
              Lokasi dan radius diambil dari dokumen laboratorium di Firestore.
            </Text>
            {labs.length === 0 ? (
              <Text style={styles.noClassesWarning}>
                Belum ada laboratorium. Tambahkan laboratorium di tab Lab terlebih dahulu.
              </Text>
            ) : (
              <View style={styles.chipRow}>
                {labs.map((lab) => {
                  const selected = lab.id === selectedLabId;
                  return (
                    <Pressable
                      key={lab.id}
                      testID={`session-lab-option-${lab.id}`}
                      onPress={() => handleSelectLab(lab)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.chip, selected && styles.chipSelected]}>
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {lab.name}
                        {lab.building ? ` (${lab.building})` : ''} • {lab.radiusMeters} m
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Tanggal Praktikum</Text>
            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => {
                setCalendarMonth((current) => {
                  const selected = dateFromKey(date);
                  return new Date(selected.getFullYear(), selected.getMonth(), 1);
                });
                setActivePicker(activePicker === 'date' ? null : 'date');
              }}
              style={styles.pickerButton}>
              <Text style={styles.pickerButtonText}>{formatDateLabel(date)}</Text>
              <Text style={styles.pickerIcon}>▦</Text>
            </Pressable>
            {activePicker === 'date' ? (
              <View style={styles.pickerPanel}>
                <View style={styles.calendarHeader}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={isCreating && dateKey(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1)) <= `${todayDate.slice(0, 8)}01`}
                    onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                    style={styles.monthButton}>
                    <Text style={styles.monthButtonText}>‹</Text>
                  </Pressable>
                  <Text style={styles.monthTitle}>{calendarMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                    style={styles.monthButton}>
                    <Text style={styles.monthButtonText}>›</Text>
                  </Pressable>
                </View>
                <View style={styles.calendarGrid}>
                  {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((day) => (
                    <Text key={day} style={styles.weekday}>{day}</Text>
                  ))}
                  {Array.from({ length: (new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1).getDay() + 6) % 7 }, (_, index) => (
                    <View key={`blank-${index}`} style={styles.calendarDay} />
                  ))}
                  {Array.from({ length: new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate() }, (_, index) => {
                    const dayDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1, 12);
                    const dayKey = dateKey(dayDate);
                    const disabled = isCreating && dayKey < todayDate;
                    const selected = dayKey === date;
                    return (
                      <Pressable
                        key={dayKey}
                        accessibilityRole="button"
                        accessibilityState={{ selected, disabled }}
                        disabled={disabled || submitting}
                        onPress={() => chooseDate(dayDate)}
                        style={[styles.calendarDay, selected && styles.calendarDaySelected, disabled && styles.calendarDayDisabled]}>
                        <Text style={[styles.calendarDayText, selected && styles.calendarDayTextSelected, disabled && styles.calendarDayTextDisabled]}>{index + 1}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {isCreating ? <Text style={styles.pickerHint}>Tanggal yang sudah lewat tidak bisa dipilih.</Text> : null}
              </View>
            ) : null}
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Waktu Mulai</Text>
              <Pressable disabled={submitting} onPress={() => setActivePicker(activePicker === 'start' ? null : 'start')} style={styles.pickerButton}>
                <Text style={styles.pickerButtonText}>{startTime || 'Pilih jam'}</Text>
                <Text style={styles.pickerIcon}>◷</Text>
              </Pressable>
            </View>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Waktu Selesai</Text>
              <Pressable disabled={submitting || !startTime} onPress={() => setActivePicker(activePicker === 'end' ? null : 'end')} style={styles.pickerButton}>
                <Text style={styles.pickerButtonText}>{endTime || 'Pilih jam'}</Text>
                <Text style={styles.pickerIcon}>◷</Text>
              </Pressable>
            </View>
          </View>
          {activePicker === 'start' || activePicker === 'end' ? (
            <View style={styles.pickerPanel}>
              <Text style={styles.pickerPanelTitle}>{activePicker === 'start' ? 'Pilih Waktu Mulai' : 'Pilih Waktu Selesai'}</Text>
              <Text style={styles.pickerHint}>
                {activePicker === 'end' ? 'Jam sebelum waktu mulai dinonaktifkan.' : isCreating && date === todayDate ? 'Pilih waktu sekarang atau setelahnya.' : 'Pilih waktu mulai praktikum.'}
              </Text>
              <ScrollView style={styles.timeGrid} contentContainerStyle={styles.timeGridContent} nestedScrollEnabled>
                {TIME_OPTIONS.map((option) => {
                  const selected = option === (activePicker === 'start' ? startTime : endTime);
                  const disabled = isTimeOptionDisabled(activePicker, option);
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled }}
                      disabled={disabled}
                      onPress={() => chooseTime(activePicker, option)}
                      style={[styles.timeOption, selected && styles.timeOptionSelected, disabled && styles.timeOptionDisabled]}>
                      <Text style={[styles.timeOptionText, selected && styles.timeOptionTextSelected, disabled && styles.timeOptionTextDisabled]}>{option}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

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
            <Text style={styles.label}>Keterangan Ruangan (Opsional)</Text>
            <TextInput
              value={room}
              editable={!submitting}
              onChangeText={setRoom}
              placeholder="Contoh: Lab Komputer 2 / Gedung E"
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
  pickerButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    backgroundColor: AppColors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  pickerButtonText: { color: AppColors.text, fontSize: 14, fontWeight: '600', flex: 1 },
  pickerIcon: { color: AppColors.primary, fontSize: 18, fontWeight: '800' },
  pickerPanel: { borderWidth: 1, borderColor: AppColors.border, borderRadius: Radius.md, padding: Spacing.two, gap: Spacing.two, backgroundColor: AppColors.background },
  calendarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: AppColors.surface },
  monthButtonText: { fontSize: 25, color: AppColors.primary, fontWeight: '700' },
  monthTitle: { color: AppColors.text, fontSize: 15, fontWeight: '800', textTransform: 'capitalize' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: '14.2857%', textAlign: 'center', paddingVertical: 8, fontSize: 11, color: AppColors.textMuted, fontWeight: '700' },
  calendarDay: { width: '14.2857%', height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.pill },
  calendarDaySelected: { backgroundColor: AppColors.primary },
  calendarDayDisabled: { opacity: 0.35 },
  calendarDayText: { color: AppColors.text, fontSize: 13, fontWeight: '600' },
  calendarDayTextSelected: { color: AppColors.textOnPrimary, fontWeight: '800' },
  calendarDayTextDisabled: { color: AppColors.textMuted },
  pickerHint: { color: AppColors.textMuted, fontSize: 11, lineHeight: 16 },
  pickerPanelTitle: { color: AppColors.text, fontSize: 14, fontWeight: '800' },
  timeGrid: { maxHeight: 210 },
  timeGridContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  timeOption: { minWidth: '22%', flexGrow: 1, paddingVertical: 9, paddingHorizontal: 5, borderWidth: 1, borderColor: AppColors.border, borderRadius: Radius.md, alignItems: 'center', backgroundColor: AppColors.surface },
  timeOptionSelected: { borderColor: AppColors.primary, backgroundColor: AppColors.primary },
  timeOptionDisabled: { opacity: 0.35 },
  timeOptionText: { color: AppColors.text, fontSize: 12, fontWeight: '700' },
  timeOptionTextSelected: { color: AppColors.textOnPrimary },
  timeOptionTextDisabled: { color: AppColors.textMuted },
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
