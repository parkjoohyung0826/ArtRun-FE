import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {Lock, LogIn, Mail, User, UserPlus} from 'lucide-react-native';
import {styles} from '../styles/appStyles';
import type {AuthMode} from '../types/app';

export function AuthScreen({
  authMode,
  authName,
  authEmail,
  authPassword,
  isSubmitting,
  onChangeAuthMode,
  onChangeName,
  onChangeEmail,
  onChangePassword,
  onSubmit,
  onSocialLogin,
}: {
  authMode: AuthMode;
  authName: string;
  authEmail: string;
  authPassword: string;
  isSubmitting: boolean;
  onChangeAuthMode: (mode: AuthMode) => void;
  onChangeName: (name: string) => void;
  onChangeEmail: (email: string) => void;
  onChangePassword: (password: string) => void;
  onSubmit: () => void;
  onSocialLogin: (provider: 'KAKAO' | 'GOOGLE') => void;
}) {
  const isSignup = authMode === 'signup';

  return (
    <ScrollView
      style={styles.panelScroll}
      contentContainerStyle={styles.authContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={styles.authBrandBlock}>
        <View style={styles.authIcon}>
          {isSignup ? (
            <UserPlus size={30} color="#fff" strokeWidth={2.6} />
          ) : (
            <LogIn size={30} color="#fff" strokeWidth={2.6} />
          )}
        </View>
        <Text style={styles.authBrand}>ArtRun</Text>
        <Text style={styles.authTitle}>{isSignup ? '회원가입' : '로그인'}</Text>
        <Text style={styles.authSub}>
          {isSignup
            ? '러닝 아트 기록과 커뮤니티 공유를 시작하세요.'
            : '저장한 루트와 완주 기록을 불러옵니다.'}
        </Text>
      </View>

      <View style={styles.authForm}>
        {isSignup && (
          <View style={styles.authField}>
            <User size={18} color="#94a3b8" strokeWidth={2.4} />
            <TextInput
              value={authName}
              onChangeText={onChangeName}
              placeholder="닉네임"
              placeholderTextColor="#64748b"
              style={styles.authInput}
            />
          </View>
        )}
        <View style={styles.authField}>
          <Mail size={18} color="#94a3b8" strokeWidth={2.4} />
          <TextInput
            value={authEmail}
            onChangeText={onChangeEmail}
            placeholder="이메일"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.authInput}
          />
        </View>
        <View style={styles.authField}>
          <Lock size={18} color="#94a3b8" strokeWidth={2.4} />
          <TextInput
            value={authPassword}
            onChangeText={onChangePassword}
            placeholder="비밀번호"
            placeholderTextColor="#64748b"
            secureTextEntry
            style={styles.authInput}
          />
        </View>

        <TouchableOpacity
          style={styles.authPrimaryButton}
          onPress={onSubmit}
          disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.authPrimaryButtonText}>
              {isSignup ? '계정 만들기' : '로그인'}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.authDividerRow}>
          <View style={styles.authDividerLine} />
          <Text style={styles.authDividerText}>또는</Text>
          <View style={styles.authDividerLine} />
        </View>

        <TouchableOpacity
          style={styles.kakaoButton}
          onPress={() => onSocialLogin('KAKAO')}
          disabled={isSubmitting}>
          <Text style={styles.kakaoIconText}>K</Text>
          <Text style={styles.kakaoButtonText}>카카오로 계속하기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={() => onSocialLogin('GOOGLE')}
          disabled={isSubmitting}>
          <Text style={styles.googleIconText}>G</Text>
          <Text style={styles.googleButtonText}>Google로 계속하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.authSwitchButton}
          disabled={isSubmitting}
          onPress={() => onChangeAuthMode(isSignup ? 'login' : 'signup')}>
          <Text style={styles.authSwitchText}>
            {isSignup ? '이미 계정이 있어요' : '새 계정 만들기'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
