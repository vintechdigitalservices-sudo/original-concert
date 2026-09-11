document.addEventListener('DOMContentLoaded', () => {
    // Navbar Scroll Effect
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // Hamburger Menu Toggle
    const hamburger = document.getElementById('hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (hamburger) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navLinks.classList.toggle('active');
        });
    }

    // Countdown Timer (index page only)
    const daysEl = document.getElementById('days');
    const targetDate = new Date('October 11, 2026 16:00:00').getTime();

    const updateCountdown = () => {
        const now = new Date().getTime();
        const distance = targetDate - now;

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
        setText('days', String(days).padStart(2, '0'));
        setText('hours', String(hours).padStart(2, '0'));
        setText('minutes', String(minutes).padStart(2, '0'));
        setText('seconds', String(seconds).padStart(2, '0'));

        if (distance < 0) {
            clearInterval(countdownInterval);
            const cd = document.querySelector('.countdown');
            if (cd) cd.innerHTML = '<h2>The Event has Started!</h2>';
        }
    };

    let countdownInterval = null;
    if (daysEl) {
        countdownInterval = setInterval(updateCountdown, 1000);
        updateCountdown();
    }

    // Reveal Animations
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Create Floating Dust Particles for Hero (index page only)
    const smokeContainer = document.getElementById('smoke');
    if (!smokeContainer) return;
    for (let i = 0; i < 50; i++) {
        const particle = document.createElement('div');
        particle.style.position = 'absolute';
        particle.style.width = Math.random() * 3 + 'px';
        particle.style.height = particle.style.width;
        particle.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
        particle.style.borderRadius = '50%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.opacity = Math.random();
        particle.style.pointerEvents = 'none';

        // Random animation for dust
        const duration = Math.random() * 10 + 10;
        const xMove = (Math.random() - 0.5) * 100;
        const yMove = (Math.random() - 0.5) * 100;

        particle.animate([
            { transform: 'translate(0, 0)', opacity: particle.style.opacity },
            { transform: `translate(${xMove}px, ${yMove}px)`, opacity: 0 }
        ], {
            duration: duration * 1000,
            iterations: Infinity,
            easing: 'linear'
        });

        smokeContainer.appendChild(particle);
    }
});
