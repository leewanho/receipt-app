import { useState } from 'react';
import { listReceipts } from './lib/db';
import { Home } from './screens/Home';
import { ListScreen } from './screens/ListScreen';
import { ScanFlow } from './screens/ScanFlow';
import { SettingsScreen } from './screens/SettingsScreen';
import type { Receipt } from './types';

type View =
  | { name: 'home' }
  | { name: 'scan'; files: File[]; existing: Receipt[] }
  | { name: 'list' }
  | { name: 'settings' };

export function App() {
  const [view, setView] = useState<View>({ name: 'home' });
  const home = (): void => setView({ name: 'home' });

  switch (view.name) {
    case 'scan':
      return <ScanFlow files={view.files} existing={view.existing} onFinish={() => setView({ name: 'list' })} />;
    case 'list':
      return <ListScreen onBack={home} />;
    case 'settings':
      return <SettingsScreen onBack={home} />;
    default:
      return (
        <Home
          onPick={async (files) => setView({ name: 'scan', files, existing: await listReceipts() })}
          onOpenList={() => setView({ name: 'list' })}
          onOpenSettings={() => setView({ name: 'settings' })}
        />
      );
  }
}
