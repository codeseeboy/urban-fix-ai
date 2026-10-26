import { Redirect } from 'expo-router';

import { useSession } from '@/store/session';

/** Entry point: send signed-in users to their home tab, everyone else to the welcome screen. */
export default function Index() {
  const signedIn = useSession((s) => !!s.token);
  return <Redirect href={signedIn ? '/home' : '/welcome'} />;
}
