import { Platform } from "react-native";
import SmartFireApp from "@/components/smart-fire-app";

export default function Index() {
  // Use SmartFireApp for web
  if (Platform.OS === 'web') {
    return <SmartFireApp />;
  }

  // For native platforms, return the web version as fallback
  return <SmartFireApp />;
}
