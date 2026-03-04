import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import DifficultyBadge from './DifficultyBadge';
import type { DanceTemplate } from '../templates/templates';

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_GAP = 12;
const CARD_W = (SCREEN_W - CARD_GAP * 3) / 2;
const CARD_H = CARD_W * 1.35;

type Props = {
  template: DanceTemplate;
  isVisible: boolean;
  onPress: (t: DanceTemplate) => void;
};

const TemplateCard: React.FC<Props> = ({ template, isVisible, onPress }) => {
  const hasThumbnailVideo = template.thumbnailVideo.length > 0;
  const hasPreviewImage = template.previewImage.length > 0;

  const player = useVideoPlayer(
    hasThumbnailVideo && isVisible ? template.thumbnailVideo : null,
    (p) => {
      p.loop = true;
      p.muted = true;
      if (isVisible) p.play();
    },
  );

  // Pause/play based on visibility
  React.useEffect(() => {
    if (!hasThumbnailVideo) return;
    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, hasThumbnailVideo, player]);

  const handlePress = useCallback(() => {
    onPress(template);
  }, [onPress, template]);

  return (
    <TouchableOpacity activeOpacity={0.85} style={styles.wrapper} onPress={handlePress}>
      <View style={styles.card}>
        {/* Video or image preview */}
        {hasThumbnailVideo && isVisible ? (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="cover"
            nativeControls={false}
          />
        ) : hasPreviewImage ? (
          <Image source={{ uri: template.previewImage }} style={styles.media} resizeMode="cover" />
        ) : (
          <View style={[styles.media, styles.placeholder]}>
            <Text style={styles.placeholderEmoji}>{'\uD83D\uDC83'}</Text>
          </View>
        )}

        {/* Bottom info overlay */}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {template.name}
          </Text>
          <View style={styles.meta}>
            <DifficultyBadge difficulty={template.difficulty} />
            <Text style={styles.duration}>{template.loopSeconds}s</Text>
          </View>
          <View style={styles.categoryRow}>
            <Text style={styles.category}>{template.category}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: CARD_W,
    marginBottom: CARD_GAP,
  },
  card: {
    height: CARD_H,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  media: {
    width: '100%',
    height: '60%',
  },
  placeholder: {
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderEmoji: {
    fontSize: 32,
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  name: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  duration: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryRow: {
    flexDirection: 'row',
  },
  category: {
    color: '#666',
    fontSize: 11,
    fontWeight: '500',
  },
});

export default React.memo(TemplateCard);
