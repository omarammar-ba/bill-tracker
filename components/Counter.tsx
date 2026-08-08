import React, { useEffect, useMemo } from 'react';
import { motion, useSpring, useTransform } from 'motion/react';

function NumberItem({ mv, number, height }: { mv: any; number: number; height: number }) {
  const y = useTransform(mv, (latest: number) => {
    const placeValue = latest % 10;
    let offset = (10 + number - placeValue) % 10;
    let memo = offset * height;
    if (offset > 5) {
      memo -= 10 * height;
    }
    return memo;
  });

  const opacity = useTransform(y, (yVal: number) => {
    return Math.abs(yVal) >= height * 0.92 ? 0 : 1;
  });

  return (
    <motion.span
      className="counter-number absolute inset-0 flex items-center justify-center select-none leading-none h-full w-full"
      style={{ y, opacity }}
    >
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

function Digit({
  place,
  value,
  height,
  digitStyle
}: {
  place: number;
  value: number;
  height: number;
  digitStyle?: React.CSSProperties;
}) {
  const valueRoundedToPlace = getValueRoundedToPlace(Math.abs(value), place);
  const animatedValue = useSpring(0, {
    stiffness: 180,
    damping: 24,
    mass: 0.4
  });

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace);
  }, [animatedValue, valueRoundedToPlace]);

  return (
    <span
      className="counter-digit relative inline-flex items-center justify-center overflow-hidden select-none align-middle"
      style={{
        height,
        lineHeight: `${height}px`,
        width: '0.55em',
        fontVariantNumeric: 'tabular-nums',
        ...digitStyle
      }}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <NumberItem key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  );
}

function getDefaultPlaces(value: number, minFrac: number, maxFrac: number): (number | string)[] {
  const absVal = Math.abs(value || 0);
  const formattedStr = absVal.toLocaleString('en-US', {
    minimumFractionDigits: minFrac,
    maximumFractionDigits: maxFrac
  });

  const dotIdx = formattedStr.indexOf('.');
  const intStr = dotIdx !== -1 ? formattedStr.slice(0, dotIdx) : formattedStr;
  const decStr = dotIdx !== -1 ? formattedStr.slice(dotIdx + 1) : '';

  const places: (number | string)[] = [];
  const intLen = intStr.replace(/,/g, '').length;
  let currentDigitCount = intLen;

  for (let i = 0; i < intStr.length; i++) {
    const char = intStr[i];
    if (char === ',') {
      places.push(',');
    } else {
      const placeValue = Math.pow(10, currentDigitCount - 1);
      places.push(placeValue);
      currentDigitCount--;
    }
  }

  if (minFrac > 0 || decStr.length > 0) {
    places.push('.');
    const totalDec = decStr.length || minFrac;
    for (let i = 1; i <= totalDec; i++) {
      places.push(Number(Math.pow(10, -i).toFixed(6)));
    }
  }

  return places;
}

export interface CounterProps {
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
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

export default function Counter({
  value = 0,
  fontSize = 32,
  padding = 0,
  places,
  gap = 0,
  borderRadius = 0,
  horizontalPadding = 0,
  textColor = 'inherit',
  fontWeight = 'inherit',
  containerStyle,
  counterStyle,
  digitStyle,
  minimumFractionDigits,
  maximumFractionDigits
}: CounterProps) {
  const height = fontSize + padding;

  const minFrac = minimumFractionDigits ?? (places ? 0 : (value % 1 !== 0 ? 3 : 0));
  const maxFrac = maximumFractionDigits ?? minFrac;

  const calculatedPlaces = useMemo(() => {
    if (places && places.length > 0) return places;
    return getDefaultPlaces(value, minFrac, maxFrac);
  }, [value, places, minFrac, maxFrac]);

  return (
    <span className="counter-container relative inline-flex items-center" style={containerStyle}>
      <span
        className="counter-counter inline-flex items-center overflow-hidden"
        style={{
          fontSize,
          gap: `${gap}px`,
          borderRadius: `${borderRadius}px`,
          paddingLeft: `${horizontalPadding}px`,
          paddingRight: `${horizontalPadding}px`,
          color: textColor,
          fontWeight,
          lineHeight: 1,
          direction: 'ltr',
          ...counterStyle
        }}
      >
        {value < 0 && (
          <span style={{ height, lineHeight: `${height}px` }} className="mr-0.5 select-none">
            -
          </span>
        )}
        {calculatedPlaces.map((place, idx) => {
          if (place === '.' || place === ',') {
            return (
              <span
                key={`symbol-${place}-${idx}`}
                className="counter-digit select-none inline-flex justify-center items-center"
                style={{
                  height,
                  lineHeight: `${height}px`,
                  width: '0.22em',
                  ...digitStyle
                }}
              >
                {place}
              </span>
            );
          }
          return (
            <Digit
              key={`place-${place}`}
              place={place as number}
              value={value}
              height={height}
              digitStyle={digitStyle}
            />
          );
        })}
      </span>
    </span>
  );
}
