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
import { getErrorMessage } from '@/services/errors';
import { parseCoordinateInput, validateLabInput, type LabInput } from '@/services/lab-service';
import { getCurrentDeviceLocation } from '@/services/location-service';
import type { Lab } from '@/types';

interface LabFormModalProps {
  visible: boolean;
  initialData?: Lab | null;
  onClose: () => void;
  onSubmit: (data: LabInput) => Promise<void>;
}

const RADIUS_PRESETS = [50, 100, 200, 300];

export function LabFormModal({ visible, initialData, onClose, onSubmit }: LabFormModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <LabFormContent
          key={initialData?.id ?? 'new-lab'}
          initialData={initialData}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      </View>
    </Modal>
  );
}

function LabFormContent({
  initialData,
  onClose,
  onSubmit,
}: {
  initialData?: Lab | null;
  onClose: () => void;
  onSubmit: (data: LabInput) => Promise<void>;
}) {
  const [name, setName] = useState(initialData?.name ?? '');
  const [building, setBuilding] = useState(initialData?.building ?? '');
  const [latitudeText, setLatitudeText] = useState(
    initialData ? String(initialData.latitude) : '',
  );
  const [longitudeText, setLongitudeText] = useState(
    initialData ? String(initialData.longitude) : '',
  );
  const [radiusText, setRadiusText] = useState(
    initialData ? String(initialData.radiusMeters) : '100',
  );
  const [description, setDescription] = useState(initialData?.description ?? '');

  const [locating, setLocating] = useState(false);
  const [locationInfo, setLocationInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleUseCurrentLocation = async () => {
    if (locating || submitting) return;
    setLocating(true);
    setLocationInfo(null);
    setError(null);
    try {
      const coords = await getCurrentDeviceLocation();
      setLatitudeText(coords.latitude.toFixed(6));
      setLongitudeText(coords.longitude.toFixed(6));
      setLocationInfo('Koordinat GPS perangkat berhasil diambil.');
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Gagal mengambil koordinat GPS perangkat.'));
    } finally {
      setLocating(false);
    }
  };

  const handleSubmit = async () => {
    const payload: LabInput = {
      name: name.trim(),
      building: building.trim() || undefined,
      latitude: parseCoordinateInput(latitudeText),
      longitude: parseCoordinateInput(longitudeText),
      radiusMeters: parseCoordinateInput(radiusText),
      description: description.trim() || undefined,
    };

    const validationError = validateLabInput(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Gagal menyimpan data laboratorium.'));
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
            {initialData ? 'Ubah Data Laboratorium' : 'Tambah Laboratorium'}
          </Text>
          <Text style={styles.subtitle}>
            Koordinat dan radius dipakai sebagai acuan validasi presensi lokasi dan marker peta.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {locationInfo ? <Text style={styles.infoText}>{locationInfo}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Nama Laboratorium</Text>
            <TextInput
              value={name}
              editable={!submitting}
              onChangeText={(text) => {
                setName(text);
                setError(null);
              }}
              placeholder="Contoh: Lab Komputasi Lanjut"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Gedung / Lokasi (Opsional)</Text>
            <TextInput
              value={building}
              editable={!submitting}
              onChangeText={(text) => {
                setBuilding(text);
                setError(null);
              }}
              placeholder="Contoh: Gedung E FSM Lantai 2"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Latitude</Text>
              <TextInput
                value={latitudeText}
                editable={!submitting && !locating}
                onChangeText={(text) => {
                  setLatitudeText(text);
                  setError(null);
                }}
                keyboardType="numbers-and-punctuation"
                placeholder="-7.049000"
                placeholderTextColor={AppColors.textMuted}
                style={styles.input}
              />
            </View>
            <View style={[styles.field, styles.flex]}>
              <Text style={styles.label}>Longitude</Text>
              <TextInput
                value={longitudeText}
                editable={!submitting && !locating}
                onChangeText={(text) => {
                  setLongitudeText(text);
                  setError(null);
                }}
                keyboardType="numbers-and-punctuation"
                placeholder="110.438004"
                placeholderTextColor={AppColors.textMuted}
                style={styles.input}
              />
            </View>
          </View>

          <Pressable
            onPress={() => void handleUseCurrentLocation()}
            disabled={locating || submitting}
            style={[styles.gpsButton, (locating || submitting) && styles.disabled]}
            accessibilityRole="button">
            <Text style={styles.gpsButtonText}>
              {locating ? '⏳ Mengambil koordinat GPS...' : '📍 Gunakan Lokasi Perangkat Saat Ini'}
            </Text>
          </Pressable>

          <View style={styles.field}>
            <Text style={styles.label}>Radius Validasi Presensi (meter)</Text>
            <TextInput
              value={radiusText}
              editable={!submitting}
              onChangeText={(text) => {
                setRadiusText(text);
                setError(null);
              }}
              keyboardType="numeric"
              placeholder="100"
              placeholderTextColor={AppColors.textMuted}
              style={styles.input}
            />
            <View style={styles.presetRow}>
              {RADIUS_PRESETS.map((preset) => {
                const active = Number(radiusText.trim()) === preset;
                return (
                  <Pressable
                    key={preset}
                    onPress={() => {
                      setRadiusText(String(preset));
                      setError(null);
                    }}
                    style={[styles.presetChip, active && styles.presetChipActive]}>
                    <Text style={[styles.presetText, active && styles.presetTextActive]}>
                      {preset} m
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Keterangan (Opsional)</Text>
            <TextInput
              value={description}
              editable={!submitting}
              onChangeText={setDescription}
              placeholder="Catatan tambahan ruang lab atau patokan gedung"
              placeholderTextColor={AppColors.textMuted}
              multiline
              numberOfLines={2}
              style={[styles.input, styles.textArea]}
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
              title={submitting ? 'Menyimpan...' : 'Simpan Lab'}
              onPress={() => void handleSubmit()}
              disabled={submitting || locating}
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
    maxHeight: '92%',
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
    lineHeight: 18,
  },
  errorText: {
    color: AppColors.danger,
    fontSize: 13,
    backgroundColor: AppColors.dangerSoft,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  infoText: {
    color: AppColors.success,
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: AppColors.successSoft,
    padding: Spacing.two,
    borderRadius: Radius.md,
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
  textArea: {
    minHeight: 68,
    paddingVertical: Spacing.two,
    textAlignVertical: 'top',
  },
  gpsButton: {
    paddingVertical: 11,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primarySoft,
    alignItems: 'center',
  },
  gpsButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primaryDark,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
    marginTop: 2,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.background,
  },
  presetChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  presetText: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.text,
  },
  presetTextActive: {
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
  disabled: {
    opacity: 0.6,
  },
});
