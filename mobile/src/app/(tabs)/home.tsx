import { CitizenHome } from '@/components/CitizenHome';
import { WorkerHome } from '@/components/WorkerHome';
import { isWorker, useSession } from '@/store/session';

export default function Home() {
  const worker = isWorker(useSession((s) => s.user?.role));
  return worker ? <WorkerHome /> : <CitizenHome />;
}
