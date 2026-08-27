/* genestjanramirez.com — motion + interactions */

// Scroll reveals
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// Nav background on scroll
const nav = document.getElementById('nav');
const onScroll = () => nav.classList.toggle('stuck', window.scrollY > 60);
onScroll();
addEventListener('scroll', onScroll, { passive: true });

// Cursor spotlight (skipped on touch — no cursor to follow)
if (matchMedia('(hover:hover)').matches) {
  addEventListener('pointermove', e => {
    document.documentElement.style.setProperty('--mx', (e.clientX / innerWidth * 100) + '%');
    document.documentElement.style.setProperty('--my', (e.clientY / innerHeight * 100) + '%');
  }, { passive: true });
}

// Hero portrait parallax
const portrait = document.getElementById('portrait');
if (portrait && matchMedia('(hover:hover)').matches && !matchMedia('(prefers-reduced-motion:reduce)').matches) {
  addEventListener('scroll', () => {
    const y = Math.min(window.scrollY, 700);
    portrait.style.transform = `translateY(${y * 0.06}px) scale(${1 + y * 0.00008})`;
  }, { passive: true });
}

// Mobile menu
document.querySelector('.burger')?.addEventListener('click', () => {
  document.querySelector('.nav-links').classList.toggle('open');
});
document.querySelectorAll('.nav-links a').forEach(a =>
  a.addEventListener('click', () => document.querySelector('.nav-links').classList.remove('open'))
);

// Year
document.getElementById('yr').textContent = new Date().getFullYear();

// Calendly placeholder guard: until the real link is pasted in, send people to email
// instead of a dead link. Delete this block once the Calendly URL is in the HTML.
document.querySelectorAll('[data-calendly]').forEach(a => {
  if (a.getAttribute('href') === 'CALENDLY_LINK_HERE') {
    a.setAttribute('href', 'mailto:genestjan@genestjanramirez.com?subject=Discovery%20Call');
    a.removeAttribute('target');
  }
});
