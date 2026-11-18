import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NAUGHTY LIST',
  description: '웹캠으로 머리를 움직여 스노우볼 속 작은 마을을 들여다보는 2분짜리 인터랙티브 작품.',
};

export const viewport: Viewport = {
  themeColor: '#030305',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko">
      <head>
        {/* Adobe Fonts kit: olivia for the title. */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/yyp5ndl.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
