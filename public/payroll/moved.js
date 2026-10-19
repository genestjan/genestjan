// keeps the installed Payroll icon working offline, so it still shows where Payroll went
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
