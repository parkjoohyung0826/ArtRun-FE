import {StyleSheet} from 'react-native';
import {authStyles} from './modules/authStyles';
import {baseStyles} from './modules/baseStyles';
import {communityStyles} from './modules/communityStyles';
import {homeStyles} from './modules/homeStyles';
import {profileStyles} from './modules/profileStyles';
import {runStyles} from './modules/runStyles';
import {sharedStyles} from './modules/sharedStyles';

export const styles = StyleSheet.create({
  ...baseStyles,
  ...homeStyles,
  ...runStyles,
  ...communityStyles,
  ...authStyles,
  ...profileStyles,
  ...sharedStyles,
} as Record<string, any>);
