declare module '@expo/vector-icons' {
  export { Ionicons } from '@expo/vector-icons/Ionicons';
  export { MaterialIcons } from '@expo/vector-icons/MaterialIcons';
  export { FontAwesome } from '@expo/vector-icons/FontAwesome';
  export { Feather } from '@expo/vector-icons/Feather';
}

declare module '@expo/vector-icons/Ionicons' {
  import { ComponentType } from 'react';
  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: any;
  }
  export const Ionicons: ComponentType<IconProps>;
  export default Ionicons;
}
