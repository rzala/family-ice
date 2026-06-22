import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { RoleGate } from './src/roles';

export default function App() {
  return (
    <SafeAreaView style={styles.fill}>
      <StatusBar style="auto" />
      <RoleGate />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
