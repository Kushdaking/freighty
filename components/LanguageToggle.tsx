/**
 * LanguageToggle — Carrier App
 * 10 languages including Arabic (RTL).
 *
 * Integration:
 *   import LanguageToggle from '@/components/LanguageToggle';
 *   <LanguageToggle />  // in header or profile screen
 *   <LanguageToggle compact />  // compact mode for tight spaces
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

// RTL-safe: fields that should NEVER be RTL-mirrored
export const LTR_ONLY_FIELDS = [
  'address', 'vin', 'phone', 'amount', 'dollar',
];

export default function LanguageToggle({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, languageInfo, isRTL } = useTranslation();
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
          <Text style={[s.label, isRTL && s.labelRTL]}>{languageInfo.native}</Text>
        )}
        <Text style={s.chevron}>▾</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setOpen(false)} />
        <SafeAreaView style={s.sheet}>
          <View style={s.handle} />
          <Text style={s.sheetTitle}>Select Language / اختر اللغة</Text>
          <FlatList
            data={LANGUAGES}
            keyExtractor={item => item.code}
            renderItem={({ item }) => {
              const isActive = item.code === language;
              const itemRTL = item.rtl === true;
              return (
                <TouchableOpacity
                  style={[s.option, isActive && s.optionActive, itemRTL && s.optionRTL]}
                  onPress={() => { setLanguage(item.code); setOpen(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={s.optionFlag}>{item.flag}</Text>
                  <View style={[s.optionText, itemRTL && s.optionTextRTL]}>
                    <Text style={[s.optionNative, isActive && s.optionNativeActive, itemRTL && s.optionNativeRTL]}>
                      {item.native}
                    </Text>
                    <Text style={[s.optionEnglish, itemRTL && s.optionEnglishRTL]}>{item.label}</Text>
                  </View>
                  {item.rtl && (
                    <Text style={s.rtlBadge}>RTL</Text>
                  )}
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
  labelRTL: { textAlign: 'right' },
  chevron: { color: DIM, fontSize: 10 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: CARD,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    borderTopWidth: 1, borderColor: BORDER,
    maxHeight: '75%',
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: BORDER, alignSelf: 'center',
    marginTop: 10, marginBottom: 4,
  },
  sheetTitle: {
    color: GOLD, fontSize: 18, fontWeight: '800',
    letterSpacing: 0.5, textAlign: 'center',
    marginVertical: 12,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 13, paddingHorizontal: 20,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  optionRTL: { flexDirection: 'row-reverse' },
  optionActive: { backgroundColor: 'rgba(201,168,76,0.08)' },
  optionFlag: { fontSize: 26 },
  optionText: { flex: 1 },
  optionTextRTL: { alignItems: 'flex-end' },
  optionNative: { color: TEXT, fontSize: 16, fontWeight: '700' },
  optionNativeActive: { color: GOLD },
  optionNativeRTL: { textAlign: 'right' },
  optionEnglish: { color: DIM, fontSize: 13, marginTop: 2 },
  optionEnglishRTL: { textAlign: 'right' },
  rtlBadge: {
    fontSize: 10, fontWeight: '700', color: '#a78bfa',
    backgroundColor: 'rgba(167,139,250,0.1)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, marginRight: 4,
  },
  check: { color: GOLD, fontSize: 18, fontWeight: '800' },
});
