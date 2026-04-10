import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import ShapeRunApp from './src/ShapeRunApp';

export default function App() {
  return (
    <SafeAreaProvider>
      <ShapeRunApp />
    </SafeAreaProvider>
  );
}
