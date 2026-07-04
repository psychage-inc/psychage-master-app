import { AlertTriangle, CheckCircle2, HeartHandshake, Shield } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { useThemeColors } from '@/lib/use-theme-colors';

import { getTierHexColor } from '../scoring';
import type { ScoreTier } from '../types';
import { openClarityAction } from './open-action';

// ConsultationGuidance — score-banded guidance block. Faithful RN port of the web
// ConsultationGuidance; copy verbatim, link targets remapped to mobile routes
// (/providers→/find, /tools→/toolkit). tel:988 opens via Linking.

interface GuidanceLink {
  readonly label: string;
  readonly to: string;
  readonly primary?: boolean;
}

interface GuidanceConfig {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly whatYouCanDo: string[];
  readonly links?: GuidanceLink[];
}

function getGuidance(score: number): GuidanceConfig {
  if (score >= 60) {
    return {
      icon: Shield,
      title: 'Keep Building on This Foundation',
      description:
        'Your wellness snapshot suggests a solid foundation. Continue the habits and routines that support your well-being. Periodic check-ins with a professional can help maintain and optimize your mental health.',
      whatYouCanDo: [
        'Continue your current wellness routines',
        'Consider periodic check-ins for maintenance and growth',
        'Share strategies that work with others who may benefit',
        'Retake this assessment in 2–4 weeks to track trends',
      ],
    };
  }
  if (score >= 40) {
    return {
      icon: HeartHandshake,
      title: 'Consider Guided Support',
      description:
        'Your responses suggest some areas could benefit from attention. Psychage tools and community resources can help, and speaking with a mental health professional is a smart next step if things do not improve.',
      whatYouCanDo: [
        'Explore Psychage wellness tools for your growth areas',
        'Speak with a mental health professional if patterns persist',
        'Track changes with regular self-assessments',
        'Build a support network you can lean on',
      ],
      links: [
        { label: 'Find a Provider', to: '/find', primary: true },
        { label: 'Explore Tools', to: '/toolkit' },
      ],
    };
  }
  if (score >= 20) {
    return {
      icon: AlertTriangle,
      title: 'Professional Consultation Recommended',
      description:
        'Your responses suggest you may be experiencing significant challenges. This is not a failure — reaching out for professional support is the clearest and most effective path to feeling better. You deserve help, and it is available.',
      whatYouCanDo: [
        'Connect with a mental health professional soon',
        'Reach out to a trusted person in your life',
        'Focus on basic self-care: sleep, nutrition, hydration',
        'Know that seeking help is a sign of strength, not weakness',
      ],
      links: [
        { label: 'Find a Provider', to: '/find', primary: true },
        { label: 'Crisis Resources', to: '/crisis' },
      ],
    };
  }
  return {
    icon: AlertTriangle,
    title: 'Urgent: please reach out today',
    description:
      'Your responses suggest you may need immediate support. This is not a diagnosis — it is a signal that talking to someone right now could genuinely help. You do not need to sort anything out first; just reach out.',
    whatYouCanDo: [
      'Call 988 — the Suicide & Crisis Lifeline is free, 24/7, and confidential',
      'Text HOME to 741741 to reach the Crisis Text Line',
      'If you or someone else is in immediate danger, call 911 or go to your nearest ER',
      'Tell one person you trust what you are going through today',
    ],
    links: [
      { label: 'Call 988', to: 'tel:988', primary: true },
      { label: 'Crisis Resources', to: '/crisis' },
      { label: 'Find a Provider', to: '/find' },
    ],
  };
}

export interface ConsultationGuidanceProps {
  readonly tier: ScoreTier;
  readonly score: number;
  readonly flags?: string[];
}

export function ConsultationGuidance({ tier, score, flags = [] }: ConsultationGuidanceProps) {
  const tc = useThemeColors();
  const config = getGuidance(score);
  const Icon = config.icon;
  const hex = getTierHexColor(tier);

  return (
    <View
      accessibilityRole="summary"
      className="overflow-hidden rounded-2xl border border-border dark:border-border-dark"
    >
      {/* Colored header */}
      <View className="flex-row items-center gap-4 p-5" style={{ backgroundColor: `${hex}15` }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: `${hex}25`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={24} color={hex} />
        </View>
        <View className="flex-1">
          <Text variant="h2">{config.title}</Text>
          {flags.length > 0 ? (
            <Text variant="caption" className="mt-0.5 text-text-secondary dark:text-text-secondary-dark">
              {flags.length} clinical indicator{flags.length !== 1 ? 's' : ''} flagged
            </Text>
          ) : null}
        </View>
      </View>

      {/* Body */}
      <View className="gap-5 p-5">
        <Text variant="caption" className="text-text-secondary dark:text-text-secondary-dark">
          {config.description}
        </Text>

        <View>
          <Text variant="label" className="mb-3 text-[14px]">
            What You Can Do
          </Text>
          <View className="gap-2.5">
            {config.whatYouCanDo.map((item) => (
              <View key={item} className="flex-row items-start gap-2.5">
                <CheckCircle2 size={16} color={tc.primary} style={{ marginTop: 2 }} />
                <Text variant="caption" className="flex-1 text-text-secondary dark:text-text-secondary-dark">
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {config.links && config.links.length > 0 ? (
          <View className="flex-row flex-wrap gap-3 pt-1">
            {config.links.map((link) => (
              <Text
                key={link.to + link.label}
                accessibilityRole="button"
                accessibilityLabel={link.label}
                onPress={() => openClarityAction(link.to)}
                style={{
                  overflow: 'hidden',
                  borderRadius: 12,
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  fontWeight: '600',
                  fontSize: 13,
                  color: link.primary ? '#fff' : tc.ink,
                  backgroundColor: link.primary ? hex : tc.inkTertiary,
                }}
              >
                {link.label}  ›
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
