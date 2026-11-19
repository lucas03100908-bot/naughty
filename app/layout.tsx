import type { Metadata, Viewport } from 'next';
import { Nanum_Gothic_Coding } from 'next/font/google';
import Script from 'next/script';
import './globals.css';

/**
 * Receipt type for the scorecard: a Korean monospace, so digits line up in columns and read
 * clearly at small sizes. Exposed as --font-receipt.
 */
const receipt = Nanum_Gothic_Coding({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-receipt', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: 'NAUGHTY LIST',
  description: '웹캠으로 머리를 움직여 스노우볼 속 작은 마을을 들여다보는 2분짜리 인터랙티브 작품.',
};

export const viewport: Viewport = {
  themeColor: '#030305',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={receipt.variable} suppressHydrationWarning>
      <head>
        {/* Adobe Fonts kit: olivia for the title. */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://use.typekit.net/yyp5ndl.css" />
      </head>
      <body>
        {children}
        {/*
          Adobe Fonts kit qxr4vmu: jjblackrose for Korean titles and messages. A Korean kit is
          dynamically subset (it only downloads the glyphs used on the page), so it loads by script.
        */}
        <Script id="typekit-ko" strategy="afterInteractive">{`
          (function(d) {
            var config = { kitId: 'qxr4vmu', scriptTimeout: 3000, async: true },
            h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\\bwf-loading\\b/g,"")+" wf-inactive";},config.scriptTimeout),tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};s.parentNode.insertBefore(tk,s)
          })(document);
        `}</Script>
      </body>
    </html>
  );
}
