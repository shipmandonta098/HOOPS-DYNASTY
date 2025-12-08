import { ToastAndroid, Platform, Alert } from "react-native";

export const showToast = (message: string) => {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    // For iOS, we'll need to use a custom toast component
    // For now, we'll skip alert and implement a custom toast in the component
  }
};
