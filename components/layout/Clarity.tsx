import Script from 'next/script';

// Microsoft Clarity (heatmaps and session recordings) for the main site.
// Paste the project ID from clarity.microsoft.com > Settings > Overview.
// Empty means Clarity stays off. Only pages built by Next.js load this, so
// /invoices, /payroll and /monggols (plain files copied in) are left out.
const CLARITY_ID = '';

/** Loads the Clarity tag once the page is interactive. Renders nothing visible. */
export default function Clarity() {
  if (!CLARITY_ID) return null;
  return (
    <Script id="clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
    </Script>
  );
}
