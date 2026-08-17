import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, MapPin, Clock, LogIn, UserPlus } from 'lucide-react-native';
import { View, ActivityIndicator } from 'react-native';
import { theme } from 'libs';

import { AuthProvider, useAuth } from '../context/AuthContext';

import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { LocationsScreen } from '../screens/LocationsScreen';
import { LocationDetailScreen } from '../screens/LocationDetailScreen';
import { CheckinsScreen } from '../screens/CheckinsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.zinc[950],
    card: theme.colors.zinc[900],
    text: theme.colors.zinc[50],
    border: theme.colors.zinc[800],
    primary: theme.colors.emerald[500],
  },
};

const AuthStack = () => (
  <Stack.Navigator id="auth" screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

const LocationsStack = () => (
  <Stack.Navigator id="locations-stack" screenOptions={{ headerShown: false }}>
    <Stack.Screen name="LocationsList" component={LocationsScreen} />
    <Stack.Screen name="LocationDetail" component={LocationDetailScreen} />
  </Stack.Navigator>
);

const MainTabs = () => (
  <Tab.Navigator
    id="main"
    screenOptions={({ route }) => ({
      tabBarIcon: ({ color, size }) => {
        if (route.name === 'Dashboard') return <Home color={color} size={size} />;
        if (route.name === 'Locations') return <MapPin color={color} size={size} />;
        if (route.name === 'Check-ins') return <Clock color={color} size={size} />;
        return null;
      },
      tabBarActiveTintColor: theme.colors.emerald[500],
      tabBarInactiveTintColor: theme.colors.zinc[400],
      headerShown: false,
      tabBarStyle: {
        backgroundColor: theme.colors.zinc[900],
        borderTopColor: theme.colors.zinc[800],
        paddingTop: 5,
      },
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} />
    <Tab.Screen name="Locations" component={LocationsStack} />
    <Tab.Screen name="Check-ins" component={CheckinsScreen} />
  </Tab.Navigator>
);

const RootNavigator = () => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.zinc[950] }}>
        <ActivityIndicator size="large" color={theme.colors.emerald[500]} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={CustomDarkTheme}>
      {token ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
};

export const App = () => {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
};

export default App;
