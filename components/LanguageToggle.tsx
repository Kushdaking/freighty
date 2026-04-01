/**
 * LanguageToggle — Carrier App
 * 
 * Compact language selector for the carrier nav header.
 * Shows current language flag + native name.
 * Tap to open modal with all 7 options.
 * 
 * Integration:
 *   import LanguageToggle from '@/components/LanguageToggle';
 *   <LanguageToggle />  // in header or profile screen
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  FlatList, Pressable, SafeAreaView,
} from 'react-native';
import { useTranslation, LANGUAGES } from '@/lib/i18n';

const GOLD = '#C9A84C';
const BG = '#0a0f1a';
const CARD = '#111827';
const BORDER = '#1e2d40';
const TEXT = '#f0f4f8';
const DIM = '#a8c4d8';

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, languageInfo } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={compact ? s.btnCompact : s.btn}
        activeOpacity={0.7}
      >
        <Text style={s.flag}>{languageInfo.flag}</Text>
        {!compact && (
          <Text style={s.label}>{languageInfo.native}</Text>
        )}
        <Text style={s.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setOpen(false)} />
        <SafeAreaView style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Select Language</Text>
          <FlatList
            data={LANGUAGES}
            keyExtractor={item => item.code}
            renderItem={({ item }) => {
              const isActive = item.code === language;
              return (
                <TouchableOpacity
                  style={[s.option, isActive && s.optionActive]}
                  onPress={() => {
                    setLanguage(item.code);
                    setOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={s.optionFlag}>{item.flag}</Text>
                  <View style={s.optionText}>
                    <Text style={[s.optionNative, isActive && s.optionNativeActive]}>
                      {item.native}
                    </Text>
                    <Text style={s.optionEnglish}>{item.label}</Text>
                  </View>
                  {isActive && <Text style={s.check}>✓</Text>}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD,
  },
  btnCompact: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1, borderColor: BORDER,
    backgroundColor: CARD,
  },
  flag: { fontSize: 18 },
  label: { color: DIM, fontSize: 13, fontWeight: '600' },
  chevron: { color: DIM, fontSize: 10 },

  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: BORDER,
    maxHeight: '70%',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: 'center', marginTop: 10, marginBottom: 4,
  },
  sheetTitle: {
    color: GOLD, fontSize: 20, fontWeight: '800',
    letterSpacing: 1, textAlign: 'center',
    marginVertical: 14,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  optionActive: {
    backgroundColor: 'rgba(201,168,76,0.08)',
  },
  optionFlag: { fontSize: 28 },
  optionText: { flex: 1 },
  optionNative: { color: TEXT, fontSize: 16, fontWeight: '700' },
  optionNativeActive: { color: GOLD },
  optionEnglish: { color: DIM, fontSize: 13, marginTop: 2 },
  check: { color: GOLD, fontSize: 18, fontWeight: '800' },
});
