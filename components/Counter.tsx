import { motion, useSpring, useTransform, MotionValue } from 'motion/react';
import React, { useEffect } from 'react';

interface NumberProps {
  mv: MotionValue<number>;
  number: number;
  height: number;
}

function Number({ mv, number, height }: NumberProps) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10;
    let offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) {
      memo -= 10 * height;
    }
    return memo;
  });
  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  );
}

function normalizeNearInteger(num: number): number {
  const nearest = Math.round(num);
  const tolerance = 1e-9 * Math.max(1, Math.abs(num));
  return Math.abs(num - nearest) < tolerance ? nearest : num;
}

function getValueRoundedToPlace(value: number, place: number): number {
  const scaled = value / place;
  return Math.floor(normalizeNearInteger(scaled));
}

interface DigitProps {
  place: number | string;
  value: number;
  height: number;
  digitStyle?: React.CSSProperties;
}

function Digit({ place, value, height, digitStyle }: DigitProps) {
  const isDecimal = place === '.';
  const isComma = place === ',';
  
  const valueRoundedToPlace = (isDecimal || isComma) ? 0 : getValueRoundedToPlace(value, place as number);
  const animatedValue = useSpring(0, {
    stiffness: 75,
    damping: 16,
    mass: 0.8
  });

  useEffect(() => {
    if (!isDecimal && !isComma) {
      animatedValue.set(0);
      const timer = setTimeout(() => {
        animatedValue.set(valueRoundedToPlace);
      }, 30);
      return () => clearTimeout(timer);
    }
  }, [valueRoundedToPlace, isDecimal, isComma]);

  if (isDecimal) {
    return (
      <span className="counter-digit" style={{ height, width: '0.25em', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...digitStyle }}>
        .
      </span>
    );
  }

  if (isComma) {
    return (
      <span className="counter-digit" style={{ height, width: '0.25em', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...digitStyle }}>
        ,
      </span>
    );
  }

  return (
    <span className="counter-digit" style={{ height, width: '0.6em', flexShrink: 0, overflow: 'hidden', ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  );
}

interface CounterProps {
  value: number;
  fontSize?: number;
  padding?: number;
  places?: (number | string)[];
  gap?: number;
  borderRadius?: number;
  horizontalPadding?: number;
  textColor?: string;
  fontWeight?: string | number;
  containerStyle?: React.CSSProperties;
  counterStyle?: React.CSSProperties;
  digitStyle?: React.CSSProperties;
  gradientHeight?: number;
  gradientFrom?: string;
  gradientTo?: string;
  topGradientStyle?: React.CSSProperties;
  bottomGradientStyle?: React.CSSProperties;
}

export default function Counter({
  value,
  fontSize = 24,
  padding = 0,
  places,
  gap = 0,
  borderRadius = 4,
  horizontalPadding = 0,
  textColor = 'inherit',
  fontWeight = 'bold',
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 4,
  gradientFrom = 'transparent',
  gradientTo = 'transparent',
  topGradientStyle,
  bottomGradientStyle
}: CounterProps) {
  const height = fontSize + padding;

  // Automatically generate places including commas for thousands separator if not provided
  const resolvedPlaces = React.useMemo(() => {
    if (places) return places;
    
    // Absolute value for extracting places
    const absValue = Math.abs(value);
    
    // Format the number to localized string to find the exact character map (e.g. "1,234.56")
    const str = absValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const chars = [...str];
    
    // We map characters in the localized string back to their place values
    const decimalIdx = chars.indexOf('.');
    
    return chars.map((ch, idx) => {
      if (ch === '.') return '.';
      if (ch === ',') return ',';
      
      const filteredBefore = chars.slice(0, idx).filter(c => c !== ',' && c !== '.').length;
      const totalFilteredWhole = chars.filter((c, i) => (decimalIdx === -1 || i < decimalIdx) && c !== ',' && c !== '.').length;
      
      if (decimalIdx === -1 || idx < decimalIdx) {
        const placePower = totalFilteredWhole - filteredBefore - 1;
        return Math.pow(10, placePower);
      } else {
        const placePower = -(idx - decimalIdx);
        return Math.pow(10, placePower);
      }
    });
  }, [value, places]);

  const defaultCounterStyle = {
    fontSize,
    gap: gap,
    borderRadius: borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    color: textColor,
    fontWeight: fontWeight,
    direction: "ltr" as const
  };

  const defaultTopGradientStyle = {
    height: gradientHeight,
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`
  };

  const defaultBottomGradientStyle = {
    height: gradientHeight,
    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`
  };

  return (
    <span className="counter-container" style={{ ...containerStyle, display: 'inline-flex', verticalAlign: 'middle', alignItems: 'center' }}>
      <style>{`
        .counter-container {
          position: relative;
          display: inline-flex;
        }
        .counter-counter {
          display: inline-flex;
          overflow: hidden;
          line-height: 1;
          align-items: center;
        }
        .counter-digit {
          position: relative;
          width: 0.6em;
          flex-shrink: 0;
          display: inline-block;
          font-variant-numeric: tabular-nums;
        }
        .counter-number {
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .gradient-container {
          pointer-events: none;
          position: absolute;
          top: 0;
          bottom: 0;
          left: 0;
          right: 0;
        }
        .bottom-gradient {
          position: absolute;
          bottom: 0;
          width: 100%;
        }
      `}</style>
      {value < 0 && <span style={{ fontSize, fontWeight, color: textColor, marginRight: '2px' }}>-</span>}
      <span className="counter-counter" style={{ ...defaultCounterStyle, ...counterStyle }}>
        {resolvedPlaces.map((place, idx) => (
          <Digit 
            key={`${place}-${idx}`} 
            place={place} 
            value={Math.abs(value)} 
            height={height} 
            digitStyle={digitStyle} 
          />
        ))}
      </span>
      {gradientFrom !== 'transparent' && (
        <span className="gradient-container">
          <span className="top-gradient" style={topGradientStyle ? topGradientStyle : defaultTopGradientStyle}></span>
          <span
            className="bottom-gradient"
            style={bottomGradientStyle ? bottomGradientStyle : defaultBottomGradientStyle}
          ></span>
        </span>
      )}
    </span>
  );
}
