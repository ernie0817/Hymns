import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HymnListView } from './src/screens/HymnListView';
import { AIChatScreen } from './src/screens/AIChatScreen';
import { HymnDetailScreen } from './src/screens/HymnDetailScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: {
    backgroundColor: '#f9f8f6', // 配合暖色背景
  },
  headerTintColor: '#4a6572', // 莫蘭迪藍文字與返回按鈕
  headerTitleStyle: {
    fontWeight: 'bold' as 'bold',
  },
  headerShadowVisible: false, // 去除頂部導覽列下方的黑線，看起來更簡潔
};

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="HymnList" screenOptions={screenOptions}>
        <Stack.Screen
          name="HymnList"
          component={HymnListView}
          options={{ title: '詩歌總覽' }}
        />
        <Stack.Screen
          name="HymnDetail"
          component={HymnDetailScreen}
          options={{ title: '詩歌內容' }}
        />
        <Stack.Screen
          name="AIChat"
          component={AIChatScreen}
          options={{ title: 'AI 詩歌助理' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
