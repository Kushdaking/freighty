import React from 'react';
import Svg, { Path, Rect, Circle, Ellipse, G, Line } from 'react-native-svg';

type CarView = 'front' | 'rear' | 'driver' | 'passenger' | 'front-quarter' | 'rear-quarter';

interface CarOutlineProps {
  view: CarView;
  size?: number;
  color?: string;
  highlightColor?: string;
}

export function CarOutline({ view, size = 160, color = '#334155', highlightColor = '#2563eb' }: CarOutlineProps) {
  const s = size;

  switch (view) {
    case 'front':
      return (
        <Svg width={s} height={s * 0.7} viewBox="0 0 200 140">
          {/* Body */}
          <Path d="M20 80 Q20 50 50 45 L80 30 Q100 25 120 30 L150 45 Q180 50 180 80 L180 110 Q180 120 170 120 L30 120 Q20 120 20 110 Z" fill="none" stroke={highlightColor} strokeWidth="3" />
          {/* Windshield */}
          <Path d="M65 45 L75 65 L125 65 L135 45 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Hood */}
          <Path d="M50 45 L65 45 L75 65 L125 65 L135 45 L150 45" fill="none" stroke={color} strokeWidth="2" />
          {/* Grille */}
          <Rect x="70" y="90" width="60" height="20" rx="3" fill="none" stroke={color} strokeWidth="2" />
          <Line x1="85" y1="90" x2="85" y2="110" stroke={color} strokeWidth="1" />
          <Line x1="100" y1="90" x2="100" y2="110" stroke={color} strokeWidth="1" />
          <Line x1="115" y1="90" x2="115" y2="110" stroke={color} strokeWidth="1" />
          {/* Headlights */}
          <Rect x="25" y="78" width="35" height="18" rx="4" fill="none" stroke={color} strokeWidth="2" />
          <Rect x="140" y="78" width="35" height="18" rx="4" fill="none" stroke={color} strokeWidth="2" />
          {/* Bumper */}
          <Path d="M22 115 L178 115" stroke={color} strokeWidth="2.5" />
          {/* Arrow indicator */}
          <Path d="M95 5 L100 15 L105 5 Z" fill={highlightColor} />
          <Line x1="100" y1="5" x2="100" y2="25" stroke={highlightColor} strokeWidth="2" />
        </Svg>
      );

    case 'rear':
      return (
        <Svg width={s} height={s * 0.7} viewBox="0 0 200 140">
          {/* Body */}
          <Path d="M20 80 Q20 50 50 45 L80 30 Q100 25 120 30 L150 45 Q180 50 180 80 L180 110 Q180 120 170 120 L30 120 Q20 120 20 110 Z" fill="none" stroke={highlightColor} strokeWidth="3" />
          {/* Rear window */}
          <Path d="M65 45 L75 65 L125 65 L135 45 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Trunk */}
          <Path d="M50 45 L65 45 L75 65 L125 65 L135 45 L150 45" fill="none" stroke={color} strokeWidth="2" />
          {/* License plate */}
          <Rect x="80" y="95" width="40" height="18" rx="2" fill="none" stroke={color} strokeWidth="2" />
          {/* Tail lights */}
          <Rect x="25" y="78" width="35" height="18" rx="4" fill="none" stroke={color} strokeWidth="2" />
          <Rect x="140" y="78" width="35" height="18" rx="4" fill="none" stroke={color} strokeWidth="2" />
          {/* Bumper */}
          <Path d="M22 115 L178 115" stroke={color} strokeWidth="2.5" />
          {/* Arrow pointing down (rear view) */}
          <Path d="M95 135 L100 125 L105 135 Z" fill={highlightColor} />
          <Line x1="100" y1="135" x2="100" y2="115" stroke={highlightColor} strokeWidth="2" />
        </Svg>
      );

    case 'driver':
      return (
        <Svg width={s * 1.6} height={s * 0.7} viewBox="0 0 320 140">
          {/* Main body */}
          <Path d="M30 90 L30 65 Q30 55 40 52 L80 40 L100 28 Q160 18 200 28 L230 40 Q270 48 280 58 L285 65 L285 90 Q285 105 275 108 L40 108 Q30 105 30 90 Z" fill="none" stroke={highlightColor} strokeWidth="3" />
          {/* Windows */}
          <Path d="M90 52 L95 70 L175 70 L175 52 Z" fill="none" stroke={color} strokeWidth="2" />
          <Path d="M180 52 L180 70 L240 70 L245 52 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Wheel arches */}
          <Path d="M55 108 Q55 90 75 90 Q95 90 95 108" fill="none" stroke={color} strokeWidth="2.5" />
          <Path d="M215 108 Q215 90 235 90 Q255 90 255 108" fill="none" stroke={color} strokeWidth="2.5" />
          {/* Wheels */}
          <Circle cx="75" cy="112" r="18" fill="none" stroke={color} strokeWidth="2.5" />
          <Circle cx="75" cy="112" r="8" fill="none" stroke={color} strokeWidth="1.5" />
          <Circle cx="235" cy="112" r="18" fill="none" stroke={color} strokeWidth="2.5" />
          <Circle cx="235" cy="112" r="8" fill="none" stroke={color} strokeWidth="1.5" />
          {/* Door lines */}
          <Line x1="175" y1="52" x2="178" y2="108" stroke={color} strokeWidth="1.5" />
          {/* Arrow left */}
          <Path d="M5 65 L15 60 L15 70 Z" fill={highlightColor} />
          <Line x1="5" y1="65" x2="25" y2="65" stroke={highlightColor} strokeWidth="2" />
        </Svg>
      );

    case 'passenger':
      return (
        <Svg width={s * 1.6} height={s * 0.7} viewBox="0 0 320 140">
          {/* Main body - mirrored */}
          <Path d="M35 90 L35 65 Q35 55 45 52 L80 40 L90 28 Q150 18 220 28 L240 40 Q270 48 285 58 L290 65 L290 90 Q290 105 280 108 L45 108 Q35 105 35 90 Z" fill="none" stroke={highlightColor} strokeWidth="3" />
          {/* Windows */}
          <Path d="M75 52 L80 70 L155 70 L155 52 Z" fill="none" stroke={color} strokeWidth="2" />
          <Path d="M160 52 L160 70 L220 70 L225 52 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Wheel arches */}
          <Path d="M60 108 Q60 90 80 90 Q100 90 100 108" fill="none" stroke={color} strokeWidth="2.5" />
          <Path d="M215 108 Q215 90 235 90 Q255 90 255 108" fill="none" stroke={color} strokeWidth="2.5" />
          {/* Wheels */}
          <Circle cx="80" cy="112" r="18" fill="none" stroke={color} strokeWidth="2.5" />
          <Circle cx="80" cy="112" r="8" fill="none" stroke={color} strokeWidth="1.5" />
          <Circle cx="235" cy="112" r="18" fill="none" stroke={color} strokeWidth="2.5" />
          <Circle cx="235" cy="112" r="8" fill="none" stroke={color} strokeWidth="1.5" />
          {/* Door line */}
          <Line x1="155" y1="52" x2="158" y2="108" stroke={color} strokeWidth="1.5" />
          {/* Arrow right */}
          <Path d="M315 65 L305 60 L305 70 Z" fill={highlightColor} />
          <Line x1="315" y1="65" x2="295" y2="65" stroke={highlightColor} strokeWidth="2" />
        </Svg>
      );

    case 'front-quarter':
      return (
        <Svg width={s * 1.3} height={s * 0.8} viewBox="0 0 260 160">
          {/* 3/4 front view body */}
          <Path d="M20 100 L20 70 Q22 55 45 48 L80 35 Q120 22 170 28 L210 42 Q240 52 245 70 L245 100 Q245 115 235 118 L30 118 Q20 115 20 100 Z" fill="none" stroke={highlightColor} strokeWidth="3" />
          {/* Windshield */}
          <Path d="M75 48 L82 72 L185 72 L200 48 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Hood */}
          <Path d="M45 48 L75 48 L82 72" fill="none" stroke={color} strokeWidth="2" />
          {/* Headlight */}
          <Rect x="22" y="85" width="38" height="18" rx="4" fill="none" stroke={color} strokeWidth="2" />
          {/* Wheel */}
          <Circle cx="70" cy="122" r="20" fill="none" stroke={color} strokeWidth="2.5" />
          <Circle cx="70" cy="122" r="9" fill="none" stroke={color} strokeWidth="1.5" />
          {/* Grille */}
          <Rect x="24" y="105" width="35" height="10" rx="2" fill="none" stroke={color} strokeWidth="1.5" />
          {/* Arrow diagonal */}
          <Path d="M15 20 L25 25 L20 35 Z" fill={highlightColor} />
          <Line x1="15" y1="20" x2="35" y2="45" stroke={highlightColor} strokeWidth="2" />
        </Svg>
      );

    case 'rear-quarter':
      return (
        <Svg width={s * 1.3} height={s * 0.8} viewBox="0 0 260 160">
          {/* 3/4 rear view body */}
          <Path d="M15 100 L15 70 Q20 52 50 45 L90 35 Q140 22 190 28 L220 40 Q245 52 245 70 L245 100 Q245 115 235 118 L25 118 Q15 115 15 100 Z" fill="none" stroke={highlightColor} strokeWidth="3" />
          {/* Rear window */}
          <Path d="M60 48 L70 72 L195 72 L205 48 Z" fill="none" stroke={color} strokeWidth="2" />
          {/* Trunk */}
          <Path d="M205 48 L220 48 L220 72" fill="none" stroke={color} strokeWidth="2" />
          {/* Tail light */}
          <Rect x="200" y="82" width="40" height="18" rx="4" fill="none" stroke={color} strokeWidth="2" />
          {/* Wheel */}
          <Circle cx="190" cy="122" r="20" fill="none" stroke={color} strokeWidth="2.5" />
          <Circle cx="190" cy="122" r="9" fill="none" stroke={color} strokeWidth="1.5" />
          {/* License plate */}
          <Rect x="105" y="100" width="40" height="16" rx="2" fill="none" stroke={color} strokeWidth="1.5" />
          {/* Arrow diagonal */}
          <Path d="M245 20 L235 25 L240 35 Z" fill={highlightColor} />
          <Line x1="245" y1="20" x2="225" y2="45" stroke={highlightColor} strokeWidth="2" />
        </Svg>
      );

    default:
      return null;
  }
}
