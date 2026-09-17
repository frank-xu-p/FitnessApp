import { Tabs } from "expo-router";
import { Home, Dumbbell, List } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useCleanUI } from "../../lib/theme";

export default function TabLayout() {
  const cleanUI = useCleanUI();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cleanUI ? "#0A84FF" : "#CCFF00",
        tabBarInactiveTintColor: cleanUI ? "#636366" : "#71717A",
        tabBarStyle: {
          backgroundColor: "#000000",
          borderTopColor: cleanUI ? "#2C2C2E" : "#27272A",
          borderTopWidth: 1,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Home size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="workouts"
        options={{
          title: "Workouts",
          tabBarIcon: ({ color, focused }) => (
            <List size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: "Exercises",
          tabBarIcon: ({ color, focused }) => (
            <Dumbbell size={22} color={color} strokeWidth={focused ? 2.5 : 2} />
          ),
        }}
      />
    </Tabs>
  );
}
