import React from 'react';
import {Text, TouchableOpacity, View} from 'react-native';
import {styles} from '../../../styles/appStyles';

export function AppHeader({onOpenProfile}: {onOpenProfile: () => void}) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>ArtRun</Text>
        <Text style={styles.brandSub}>AI Shape Route Coach</Text>
      </View>
      <TouchableOpacity style={styles.headerPill} onPress={onOpenProfile}>
        <Text style={styles.headerPillText}>MY</Text>
      </TouchableOpacity>
    </View>
  );
}
