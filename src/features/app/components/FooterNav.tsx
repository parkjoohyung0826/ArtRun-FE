import React from 'react';
import {View} from 'react-native';
import {FooterItem} from '../../../components/AppChrome';
import {styles} from '../../../styles/appStyles';
import type {TabKey} from '../../../types/app';

export function FooterNav({
  activeTab,
  bottomInset,
  onChangeTab,
}: {
  activeTab: TabKey;
  bottomInset: number;
  onChangeTab: (tab: TabKey) => void;
}) {
  return (
    <View style={[styles.footer, {paddingBottom: bottomInset}]}>
      <FooterItem
        label="홈"
        icon="home"
        active={activeTab === 'home'}
        onPress={() => onChangeTab('home')}
      />
      <FooterItem
        label="러닝"
        icon="run"
        active={activeTab === 'run'}
        onPress={() => onChangeTab('run')}
      />
      <FooterItem
        label="공유"
        icon="community"
        active={activeTab === 'community'}
        onPress={() => onChangeTab('community')}
      />
      <FooterItem
        label="마이"
        icon="profile"
        active={activeTab === 'profile'}
        onPress={() => onChangeTab('profile')}
      />
    </View>
  );
}
