import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RoleGate } from './src/roles';

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.fill}>
        <StatusBar style="auto" />
        <RoleGate />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
