import React from 'react';
import { Image, ImageStyle, StyleProp } from 'react-native';

const SOURCE = require('../assets/images/logo.png');

type BrandMarkProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/** Canonical ShieldCall AI mark: cyan outline shield with a phone handset. */
export function BrandMark({ size = 40, style }: BrandMarkProps) {
  return (
    <Image
      source={SOURCE}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="ShieldCall AI"
    />
  );
}
