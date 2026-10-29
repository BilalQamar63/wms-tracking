import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'WMS Tracking', template: '%s · WMS Tracking' },
  description: 'Master PTW Tracking Register',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
