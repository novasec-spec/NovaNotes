// components/DoodlePanel.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { DOODLE_COLORS, WHITE } from '../utils/constants';

const { width: W } = Dimensions.get('window');

interface DoodlePanelProps {
  themeAccent: string;
  existingDoodle?: string;
  onSave: (doodleData: string) => void;
  onClose: () => void;
  colors: any;
}

export function DoodlePanel({
  themeAccent,
  existingDoodle,
  onSave,
  onClose,
  colors,
}: DoodlePanelProps) {
  const [selectedColor, setSelectedColor] = useState(DOODLE_COLORS[0]);
  const [brushSize, setBrushSize] = useState(4);
  const [paths, setPaths] = useState<{ points: { x: number; y: number }[]; color: string; size: number }[]>([]);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 300, height: 300 });

  useEffect(() => {
    if (existingDoodle) {
      try {
        const parsed = JSON.parse(existingDoodle);
        if (parsed.paths) {
          setPaths(parsed.paths);
        }
      } catch (e) {
        console.error('Failed to parse doodle:', e);
      }
    }
  }, [existingDoodle]);

  const handleTouchStart = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    setCurrentPath([{ x: locationX, y: locationY }]);
  };

  const handleTouchMove = (e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    if (currentPath.length > 0) {
      setCurrentPath([...currentPath, { x: locationX, y: locationY }]);
    }
  };

  const handleTouchEnd = () => {
    if (currentPath.length > 1) {
      setPaths([
        ...paths,
        { points: [...currentPath], color: selectedColor, size: brushSize },
      ]);
    }
    setCurrentPath([]);
  };

  const undoLast = () => {
    setPaths(prev => prev.slice(0, -1));
  };

  const clearCanvas = () => {
    setPaths([]);
    setCurrentPath([]);
  };

  const saveDoodle = () => {
    const doodleJSON = JSON.stringify({ paths, canvasSize });
    onSave(doodleJSON);
    onClose();
  };

  const renderDoodle = () => {
    const allPaths = [...paths];
    if (currentPath.length > 1) {
      allPaths.push({ points: currentPath, color: selectedColor, size: brushSize });
    }

    return allPaths.map((path, idx) => {
      if (path.points.length < 2) return null;

      const points = path.points;
      const lines = [];

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        lines.push(
          <View
            key={`${idx}-${i}`}
            style={{
              position: 'absolute',
              left: p1.x,
              top: p1.y,
              width: length,
              height: path.size,
              backgroundColor: path.color,
              transform: [{ rotate: `${angle}deg` }],
              borderRadius: path.size / 2,
            }}
          />
        );
      }

      return lines;
    });
  };

  return (
    <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }]}>
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose}>
            <Icon name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Doodle</Text>
          <TouchableOpacity onPress={saveDoodle}>
            <Icon name="checkmark-done" size={22} color={themeAccent} />
          </TouchableOpacity>
        </View>

        <View
          style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}
          onLayout={(e) => setCanvasSize({
            width: e.nativeEvent.layout.width,
            height: e.nativeEvent.layout.height,
          })}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}>

          {renderDoodle()}

          {paths.length === 0 && currentPath.length === 0 && (
            <View style={styles.emptyWrap}>
              <MCIcon name="brush" size={36} color={colors.text} />
              <Text style={[styles.hint, { color: colors.text }]}>Draw here</Text>
            </View>
          )}
        </View>

        <View style={styles.colorRow}>
          {DOODLE_COLORS.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => setSelectedColor(c)}
              style={[
                styles.colorDot,
                { backgroundColor: c, borderWidth: c === '#FFFFFF' ? 1 : 0, borderColor: colors.border },
                selectedColor === c && { borderColor: colors.text, borderWidth: 3, transform: [{ scale: 1.2 }] },
              ]}
            />
          ))}
        </View>

        <View style={styles.brushRow}>
          {[2, 4, 8, 14].map(s => (
            <TouchableOpacity
              key={s}
              onPress={() => setBrushSize(s)}
              style={[styles.brushBtn, brushSize === s && { borderColor: themeAccent, borderWidth: 2 }]}>
              <View style={{ width: s * 2.2, height: s * 2.2, borderRadius: s, backgroundColor: selectedColor }} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={undoLast}>
            <Icon name="arrow-undo-outline" size={16} color={colors.text} />
            <Text style={[styles.btnTxt, { color: colors.text }]}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.border }]} onPress={clearCanvas}>
            <Icon name="trash-outline" size={16} color={colors.text} />
            <Text style={[styles.btnTxt, { color: colors.text }]}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: themeAccent }]} onPress={saveDoodle}>
            <Icon name="save-outline" size={16} color={WHITE} />
            <Text style={[styles.btnTxt, { color: WHITE }]}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
);
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, padding: 20, paddingBottom: 100 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800' },
  canvas: { flex: 1, borderRadius: 20, borderWidth: 1.5, marginBottom: 16, overflow: 'hidden', minHeight: 220, position: 'relative' },
  emptyWrap: { position: 'absolute', top: '50%', left: '50%', transform: [{ translateX: -50 }, { translateY: -30 }], alignItems: 'center', gap: 8 },
  hint: { fontSize: 14 },
  colorRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 12 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  brushRow: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginBottom: 16, alignItems: 'center' },
  brushBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
  actions: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16 },
  btnTxt: { fontWeight: '800', fontSize: 14 },
});
