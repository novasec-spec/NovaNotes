// components/NoteEditor.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
  Image,
  ImageBackground,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
  Modal,
  ActivityIndicator,
  Alert,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Location from 'expo-location';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { Note, NOTE_TEMPLATES, VoiceNote } from '../types';
import { 
  NOTE_THEMES, 
  MOOD_OPTIONS, 
  STICKER_OPTIONS, 
  TAG_SUGGESTIONS, 
  MAX_CHARS,
  WHITE,
  TEXT_SOFT,
  TEXT_MID,
  DANGER,
} from '../utils/constants';
import { wordCount, getReadTime } from '../utils/helpers';
import { VoiceRecorder } from './VoiceRecorder';
import { DoodlePanel } from './DoodlePanel';
import { VoicePlayer } from './VoicePlayer';

const { width: W, height: H } = Dimensions.get('window');

const EditorBackground: React.FC<{ bgPhotoUri: string | null; colors: any; children: React.ReactNode }> = ({ bgPhotoUri, colors, children }) => {
  if (bgPhotoUri) {
    return (
      <ImageBackground source={{ uri: bgPhotoUri }} style={{ flex: 1 }} imageStyle={{ opacity: 0.28 }}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background + 'CC' }]} />
        {children}
      </ImageBackground>
    );
  }
  return <View style={{ flex: 1, backgroundColor: colors.background }}>{children}</View>;
};

interface NoteEditorProps {
  visible: boolean;
  initial: any | null;
  onSave: (data: any) => void;
  onClose: () => void;
  colors: any;
  onAddLocation?: (noteId: string) => void;
  onAddWeather?: (noteId: string) => void;
  onApplyTemplate?: (templateId: string) => Partial<Note>;
}

export function NoteEditor({ 
  visible, 
  initial, 
  onSave, 
  onClose, 
  colors,
  onAddLocation,
  onAddWeather,
  onApplyTemplate,
}: NoteEditorProps) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [place, setPlace] = useState('');
  const [event, setEvent] = useState('');
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [themeIndex, setThemeIndex] = useState(0);
  const [moodIndex, setMoodIndex] = useState<number | null>(null);
  const [stickerIndex, setStickerIndex] = useState<number | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [bgPhotoUri, setBgPhotoUri] = useState<string | null>(null);
  const [hasDoodle, setHasDoodle] = useState(false);
  const [doodleData, setDoodleData] = useState<string | null>(null);
  const [voiceNote, setVoiceNote] = useState<VoiceNote | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  const [showDoodle, setShowDoodle] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(H)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const titleInputRef = useRef<TextInput>(null);
  const bodyInputRef = useRef<TextInput>(null);

  // Keyboard handling
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  useEffect(() => {
    if (visible) {
      if (initial) {
        setTitle(initial.title ?? '');
        setBody(initial.text ?? '');
        setPlace(initial.place ?? '');
        setEvent(initial.event ?? '');
        setAuthor(initial.author ?? '');
        setTags(initial.tags ?? []);
        setThemeIndex(initial.themeIndex ?? 0);
        setMoodIndex(initial.moodIndex ?? null);
        setStickerIndex(initial.stickerIndex ?? null);
        setPhotoUri(initial.photoUri ?? null);
        setBgPhotoUri(initial.bgPhotoUri ?? null);
        setHasDoodle(initial.hasDoodle ?? false);
        setDoodleData(initial.doodleData ?? null);
        setVoiceNote(initial.voiceNote ?? null);
      } else {
        setTitle(''); setBody(''); setPlace(''); setEvent('');
        setAuthor(''); setTags([]); setTagInput('');
        setThemeIndex(Math.floor(Math.random() * NOTE_THEMES.length));
        setMoodIndex(null); setStickerIndex(null);
        setPhotoUri(null); setBgPhotoUri(null);
        setHasDoodle(false); setDoodleData(null); setVoiceNote(null);
        setShowOptional(false);
      }
      setDirty(false);
      Animated.spring(slideAnim, {
        toValue: 0, friction: 18, tension: 120, useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: H, duration: 260, useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const theme = NOTE_THEMES[themeIndex];
  const chars = body.length;
  const readTime = getReadTime(body);

  const markDirty = () => setDirty(true);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to attach images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      markDirty();
    }
  };

  const pickBackgroundPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set a background.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setBgPhotoUri(result.assets[0].uri);
      setShowBgPicker(false);
      markDirty();
    }
  };

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase();
    if (!clean || tags.includes(clean)) return;
    setTags([...tags, clean]);
    setTagInput('');
    markDirty();
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
    markDirty();
  };

  const applyTemplate = (templateId: string) => {
    if (onApplyTemplate) {
      const template = onApplyTemplate(templateId);
      if (template.title) setTitle(template.title);
      if (template.text) setBody(template.text);
      setShowTemplates(false);
      markDirty();
    }
  };


const handleAddLocation = async () => {
  try {
    // Request permissions
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow location access to add your current location.');
      return;
    }

    // Get current position
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    // Reverse geocode to get address
    const addresses = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    if (addresses.length > 0) {
      const address = addresses[0];
      
      // Create a readable location string
      const locationName = address.city || address.town || address.village || 
                          address.region || address.country || 
                          `${address.latitude.toFixed(4)}, ${address.longitude.toFixed(4)}`;
      
      // Update the place state
      setPlace(locationName);
      markDirty();
      
      Alert.alert('📍 Location added', `${locationName} has been added to this note.`);
    }
  } catch (error) {
    console.error('Location error:', error);
    Alert.alert('Error', 'Failed to get location. Please try again.');
  }
};

const handleAddWeather = async () => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow location access for weather.');
      return;
    }
    
    const location = await Location.getCurrentPositionAsync({});
    // Use OpenWeatherMap or similar API
    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${location.coords.latitude}&lon=${location.coords.longitude}&appid=56dc1d8690586ac94c8ad8281302ceec&units=metric`
    );
    const data = await response.json();
    
    const weatherInfo = `${data.weather[0].main} • ${Math.round(data.main.temp)}°C • ${data.name}`;
    setPlace(weatherInfo); // or create separate weather state
    markDirty();
    Alert.alert('🌤️ Weather added', weatherInfo);
  } catch (error) {
    Alert.alert('Error', 'Failed to fetch weather data.');
  }
};
  const handleClose = () => {
    if (dirty && (body.trim() || title.trim())) {
      Alert.alert('Discard changes?', 'You have unsaved changes.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]);
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!body.trim()) {
      Alert.alert('Empty note', 'Write something first!');
      return;
    }

    setSaving(true);

    try {
      const noteData = {
        title: title.trim(),
        text: body.trim(),
        place: place.trim(),
        event: event.trim(),
        author: author.trim(),
        tags,
        themeIndex,
        moodIndex,
        stickerIndex,
        photoUri: photoUri || '',
        photoFileName: '',
        bgPhotoUri: bgPhotoUri || '',
        bgPhotoFileName: '',
        hasDoodle,
        doodleData: doodleData || '',
        doodleFileName: '',
        voiceNote: voiceNote || undefined,
        voiceFileName: '',
        readTime: readTime,
        _synced: false,
      };

      onSave(noteData);
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          styles.editorScreen,
          { transform: [{ translateY: slideAnim }] },
        ]}>
        <StatusBar barStyle={colors.statusBar || 'dark-content'} />
      <EditorBackground bgPhotoUri={bgPhotoUri} colors={colors}>
          <SafeAreaView style={{ flex: 1 }} edges={['top']}>
            {/* Top Bar */}
            <View style={[styles.topBar, { backgroundColor: colors.card + 'CC' }]}>
              <TouchableOpacity onPress={handleClose} style={styles.topBarBtn}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              
              <Text style={[styles.topBarTitle, { color: colors.text }]}>
                {initial ? 'Edit Note' : 'New Note'}
              </Text>
              
              <TouchableOpacity onPress={handleSave} style={[styles.saveBtn, { backgroundColor: theme.accent }]} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color={WHITE} />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <KeyboardAvoidingView 
              style={{ flex: 1 }} 
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
              
              <ScrollView
                ref={scrollViewRef}
                style={{ flex: 1 }}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: keyboardVisible ? 200 : 100 }]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                scrollEnabled={true}>
                
                {/* Theme Selector */}
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.themeScroll}>
                  {NOTE_THEMES.map((t, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => { setThemeIndex(i); markDirty(); }}
                      style={[
                        styles.themeCircle,
                        { backgroundColor: t.bg },
                        themeIndex === i && { borderWidth: 3, borderColor: t.accent },
                      ]}>
                      {themeIndex === i && (
                        <View style={[styles.themeCheck, { backgroundColor: t.accent }]}>
                          <Icon name="checkmark" size={10} color={WHITE} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Title Input */}
                <TextInput
                  ref={titleInputRef}
                  style={[styles.titleInput, { color: theme.accent }]}
                  placeholder="Note title..."
                  placeholderTextColor={theme.accent + '66'}
                  value={title}
                  onChangeText={t => { setTitle(t); markDirty(); }}
                  maxLength={80}
                  returnKeyType="next"
                  onSubmitEditing={() => bodyInputRef.current?.focus()}
                />

                {/* Body Input */}
                <TextInput
                  ref={bodyInputRef}
                  style={[styles.bodyInput, { 
                    color: colors.text, 
                    backgroundColor: colors.card,
                    minHeight: 200,
                  }]}
                  placeholder="Write your thoughts here..."
                  placeholderTextColor={TEXT_SOFT}
                  value={body}
                  onChangeText={t => { 
                    if (t.length <= MAX_CHARS) { 
                      setBody(t); 
                      markDirty(); 
                    } 
                  }}
                  multiline
                  textAlignVertical="top"
                  keyboardType="default"
                />

                {/* Word Count */}
                <View style={styles.countRow}>
                  <Text style={[styles.countText, { color: colors.text }]}>
                    {wordCount(body)} words • {readTime} min read
                  </Text>
                  <Text style={[styles.countText, { color: colors.text }, chars > MAX_CHARS * 0.9 && { color: DANGER }]}>
                    {chars}/{MAX_CHARS}
                  </Text>
                </View>

                {/* Quick Actions Row */}
                <View style={styles.quickActionsRow}>
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: colors.card }]}
                    onPress={() => setShowTemplates(true)}>
                    <Icon name="copy-outline" size={18} color={theme.accent} />
                    <Text style={[styles.quickActionText, { color: theme.accent }]}>Template</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: colors.card }]}
                    onPress={handleAddLocation}>
                    <Icon name="location-outline" size={18} color={theme.accent} />
                    <Text style={[styles.quickActionText, { color: theme.accent }]}>Location</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.quickActionBtn, { backgroundColor: colors.card }]}
                    onPress={handleAddWeather}>
                    <Icon name="partly-sunny-outline" size={18} color={theme.accent} />
                    <Text style={[styles.quickActionText, { color: theme.accent }]}>Weather</Text>
                  </TouchableOpacity>
                </View>

                {/* Voice Note */}
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Voice Note</Text>
                  {voiceNote ? (
                    <View style={styles.voiceContainer}>
                      <VoicePlayer voiceNote={voiceNote} themeAccent={theme.accent} colors={colors} />
                      <TouchableOpacity onPress={() => { setVoiceNote(null); markDirty(); }}>
                        <Icon name="close-circle" size={24} color={DANGER} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addBtn, { borderColor: theme.accent + '55', backgroundColor: colors.card }]}
                      onPress={() => setShowVoiceRecorder(true)}>
                      <Icon name="mic-outline" size={20} color={theme.accent} />
                      <Text style={[styles.addBtnText, { color: theme.accent }]}>Record Voice Note</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Mood */}
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Mood</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.moodRow}>
                      {MOOD_OPTIONS.map((m, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => { setMoodIndex(moodIndex === i ? null : i); markDirty(); }}
                          style={[
                            styles.moodBtn,
                            {
                              borderColor: moodIndex === i ? m.color : colors.border,
                              backgroundColor: moodIndex === i ? m.color + '18' : colors.card,
                            },
                          ]}>
                          <Icon name={m.icon} size={24} color={m.color} />
                          <Text style={[styles.moodLabel, { color: m.color }]}>{m.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Stickers */}
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Sticker</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.stickerRow}>
                      {STICKER_OPTIONS.map((s, i) => (
                        <TouchableOpacity
                          key={i}
                          onPress={() => { setStickerIndex(stickerIndex === i ? null : i); markDirty(); }}
                          style={[
                            styles.stickerBtn,
                            {
                              borderColor: stickerIndex === i ? s.color : colors.border,
                              backgroundColor: stickerIndex === i ? s.color + '22' : colors.card,
                            },
                          ]}>
                          <MCIcon name={s.name} size={28} color={s.color} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Tags */}
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Tags</Text>
                  <View style={styles.tagInputRow}>
                    <TextInput
                      style={[styles.tagInput, { 
                        color: colors.text, 
                        backgroundColor: colors.card, 
                        borderColor: colors.border 
                      }]}
                      placeholder="Add tag..."
                      placeholderTextColor={TEXT_SOFT}
                      value={tagInput}
                      onChangeText={setTagInput}
                      onSubmitEditing={() => addTag(tagInput)}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      style={[styles.tagAddBtn, { backgroundColor: theme.accent }]}
                      onPress={() => addTag(tagInput)}>
                      <Icon name="add" size={20} color={WHITE} />
                    </TouchableOpacity>
                  </View>
                  
                  {tags.length > 0 && (
                    <View style={styles.tagsContainer}>
                      {tags.map(tag => (
                        <TouchableOpacity key={tag} onPress={() => removeTag(tag)} style={[styles.tagChip, { backgroundColor: theme.accent + '22' }]}>
                          <Text style={[styles.tagChipText, { color: theme.accent }]}>#{tag}</Text>
                          <Icon name="close" size={14} color={theme.accent} />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Attachments */}
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Attachments</Text>
                  <View style={styles.attachRow}>
                    <TouchableOpacity 
                      style={[styles.attachBtn, { borderColor: theme.accent + '55', backgroundColor: colors.card }]} 
                      onPress={pickPhoto}>
                      <Icon name="image-outline" size={20} color={theme.accent} />
                      <Text style={[styles.attachBtnText, { color: theme.accent }]}>
                        {photoUri ? 'Change Photo' : 'Add Photo'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.attachBtn, { 
                        borderColor: hasDoodle ? theme.accent : theme.accent + '55', 
                        backgroundColor: colors.card 
                      }]}
                      onPress={() => setShowDoodle(true)}>
                      <MCIcon name="brush" size={20} color={theme.accent} />
                      <Text style={[styles.attachBtnText, { color: theme.accent }]}>
                        {hasDoodle ? 'Edit Doodle' : 'Doodle'}
                      </Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.attachBtn, { 
                        borderColor: bgPhotoUri ? theme.accent : theme.accent + '55', 
                        backgroundColor: colors.card 
                      }]}
                      onPress={() => setShowBgPicker(true)}>
                      <Icon name="image-outline" size={20} color={theme.accent} />
                      <Text style={[styles.attachBtnText, { color: theme.accent }]}>
                        {bgPhotoUri ? 'Change BG' : 'Add BG'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Optional Fields Toggle */}
                <TouchableOpacity
                  style={[styles.optionalToggle, { borderColor: theme.accent + '44', backgroundColor: colors.card }]}
                  onPress={() => setShowOptional(v => !v)}>
                  <Icon name={showOptional ? 'chevron-up' : 'chevron-down'} size={18} color={theme.accent} />
                  <Text style={[styles.optionalToggleText, { color: theme.accent }]}>
                    {showOptional ? 'Hide Optional Fields' : 'Show Optional Fields'}
                  </Text>
                </TouchableOpacity>

                {showOptional && (
                  <View style={styles.optionalFields}>
                    <View style={[styles.optField, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Icon name="location-outline" size={20} color={TEXT_MID} />
                      <TextInput
                        style={[styles.optInput, { color: colors.text }]}
                        placeholder="Place..."
                        placeholderTextColor={TEXT_SOFT}
                        value={place}
                        onChangeText={t => { setPlace(t); markDirty(); }}
                      />
                    </View>
                    
                    <View style={[styles.optField, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Icon name="calendar-outline" size={20} color={TEXT_MID} />
                      <TextInput
                        style={[styles.optInput, { color: colors.text }]}
                        placeholder="Event..."
                        placeholderTextColor={TEXT_SOFT}
                        value={event}
                        onChangeText={t => { setEvent(t); markDirty(); }}
                      />
                    </View>
                    
                    <View style={[styles.optField, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Icon name="person-outline" size={20} color={TEXT_MID} />
                      <TextInput
                        style={[styles.optInput, { color: colors.text }]}
                        placeholder="Author..."
                        placeholderTextColor={TEXT_SOFT}
                        value={author}
                        onChangeText={t => { setAuthor(t); markDirty(); }}
                      />
                    </View>
                  </View>
                )}
              </ScrollView>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </EditorBackground>

        {/* Templates Modal */}
        <Modal visible={showTemplates} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Template</Text>
                <TouchableOpacity onPress={() => setShowTemplates(false)}>
                  <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <ScrollView>
                {Object.entries(NOTE_TEMPLATES).map(([key, template]) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.templateItem, { borderBottomColor: colors.border }]}
                    onPress={() => applyTemplate(key)}>
                    <View>
                      <Text style={[styles.templateItemTitle, { color: theme.accent }]}>{template.title}</Text>
                      <Text style={[styles.templateItemPreview, { color: colors.text }]} numberOfLines={2}>
                        {template.text}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={20} color={TEXT_SOFT} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Background Picker Modal */}
        <Modal visible={showBgPicker} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Background</Text>
                <TouchableOpacity onPress={() => setShowBgPicker(false)}>
                  <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              <Text style={[styles.modalSubtitle, { color: TEXT_MID }]}>Pick a color theme</Text>
              <View style={styles.bgThemeGrid}>
                {NOTE_THEMES.map((t, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => { setThemeIndex(i); setBgPhotoUri(null); markDirty(); setShowBgPicker(false); }}
                    style={[
                      styles.bgThemeSwatch,
                      { backgroundColor: t.bg },
                      themeIndex === i && !bgPhotoUri && { borderWidth: 3, borderColor: t.accent },
                    ]}>
                    {themeIndex === i && !bgPhotoUri && <Icon name="checkmark" size={16} color={t.accent} />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.modalSubtitle, { color: TEXT_MID, marginTop: 16 }]}>Or use a photo</Text>
              <TouchableOpacity
                style={[styles.bgPhotoBtn, { borderColor: theme.accent, backgroundColor: theme.accent + '12' }]}
                onPress={pickBackgroundPhoto}>
                <Icon name="image-outline" size={20} color={theme.accent} />
                <Text style={[styles.bgPhotoBtnText, { color: theme.accent }]}>
                  {bgPhotoUri ? 'Change Background Photo' : 'Choose Background Photo'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Doodle Modal */}
        {showDoodle && (
          <DoodlePanel
            themeAccent={theme.accent}
            existingDoodle={doodleData || undefined}
            onSave={(data) => {
              setDoodleData(data);
              setHasDoodle(true);
              setShowDoodle(false);
              markDirty();
            }}
            onClose={() => setShowDoodle(false)}
            colors={colors}
          />
        )}

        {/* Voice Recorder Modal */}
        <Modal visible={showVoiceRecorder} transparent animationType="slide">
          <View style={styles.voiceModalOverlay}>
            <VoiceRecorder
              themeAccent={theme.accent}
              onSave={(voice) => {
                setVoiceNote(voice);
                setShowVoiceRecorder(false);
                markDirty();
              }}
              onCancel={() => setShowVoiceRecorder(false)}
              colors={colors}
            />
          </View>
        </Modal>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  editorScreen: { zIndex: 1000 },
  
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  topBarBtn: { padding: 8 },
  topBarTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  saveBtnText: { color: WHITE, fontWeight: '700', fontSize: 14 },
  
  scrollContent: { paddingHorizontal: 16, paddingTop: 12 },
  
  themeScroll: { flexGrow: 0, marginBottom: 16 },
  themeCircle: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  themeCheck: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  
  titleInput: { fontSize: 22, fontWeight: '800', paddingVertical: 8, marginBottom: 12 },
  bodyInput: { fontSize: 16, lineHeight: 24, padding: 14, borderRadius: 12, minHeight: 200 },
  
  countRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  countText: { fontSize: 12, opacity: 0.6 },
  
  quickActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  quickActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  quickActionText: { fontSize: 12, fontWeight: '600' },
  
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  
  voiceContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed' },
  addBtnText: { fontSize: 14, fontWeight: '600' },
  
  moodRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  moodBtn: { alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, minWidth: 60 },
  moodLabel: { fontSize: 10, fontWeight: '700' },
  
  stickerRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  stickerBtn: { padding: 10, borderRadius: 12, borderWidth: 1.5 },
  
  tagInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tagInput: { flex: 1, fontSize: 14, borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  tagAddBtn: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  tagChipText: { fontSize: 12, fontWeight: '600' },
  
  attachRow: { flexDirection: 'row', gap: 8 },
  attachBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed' },
  attachBtnText: { fontSize: 12, fontWeight: '600' },
  
  optionalToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, marginBottom: 12 },
  optionalToggleText: { fontSize: 13, fontWeight: '600' },
  
  optionalFields: { gap: 10, marginBottom: 12 },
  optField: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  optInput: { flex: 1, fontSize: 14, paddingVertical: 12 },
  
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalSubtitle: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  
  templateItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1 },
  templateItemTitle: { fontSize: 16, fontWeight: '700' },
  templateItemPreview: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  
  bgThemeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  bgThemeSwatch: { width: 48, height: 48, borderRadius: 12, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  bgPhotoBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, marginTop: 4 },
  bgPhotoBtnText: { fontSize: 14, fontWeight: '600' },
  
  voiceModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
});
