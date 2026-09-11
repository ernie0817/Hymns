import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HymnListView } from './src/screens/HymnListView';
import { AIChatScreen } from './src/screens/AIChatScreen';
import { HymnDetailScreen } from './src/screens/HymnDetailScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="HymnList">
        <Stack.Screen 
          name="HymnList" 
          component={HymnListView} 
          options={{ title: '詩歌瀏覽' }} 
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
