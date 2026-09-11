document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get('ticket');
    let attendee = null;

    const attendeeDataRaw = localStorage.getItem('currentAttendee');
    if (attendeeDataRaw) {
        try { attendee = JSON.parse(attendeeDataRaw); } catch (e) { attendee = null; }
    }

    // Allow opening a ticket from its QR verification link (?ticket=ID)
    // by loading the data-only record from Firestore. Photos are never
    // stored, so the flyer portrait only appears on the original device.
    if (!attendee && ticketParam && window.db) {
        try {
            const snap = await window.db.collection('tickets').doc(ticketParam).get();
            if (snap.exists) {
                attendee = snap.data();
                attendee.photo = null;
            }
        } catch (e) { /* fall through to redirect below */ }
    }

    if (!attendee) {
        window.location.href = 'register.html';
        return;
    }
    const container = document.getElementById('asset-container');
    const loader = document.getElementById('assets-loading');

    // 1. Populate Ticket Data
    document.getElementById('attendee-name').innerText = attendee.fullName;
    document.getElementById('ticket-id-display').innerText = attendee.ticketId;

    // 2. Standard, valid QR Code (no name shown under the code on the ticket).
    // Encodes a stable verification URL + structured ticket fields, rendered
    // with a quiet zone so any scanner can read it.
    function buildQrPayload() {
        const verifyUrl = 'https://original-concert.vercel.app/ticket.html?ticket=' + encodeURIComponent(attendee.ticketId);
        return [
            'ORIGINAL CONCERT 3.0',
            'Event: Original Concert 3.0',
            'Attendee: ' + attendee.fullName,
            'Ticket ID: ' + attendee.ticketId,
            'Verify: ' + verifyUrl
        ].join('\n');
    }

    function renderQRWithLib(qrText) {
        const el = document.getElementById('qrcode');
        el.innerHTML = '';

        // Preferred: qrcode-generator (correct QR spec, quiet zone, scaling)
        if (typeof qrcode !== 'undefined') {
            const qr = qrcode(0, 'M');
            qr.addData(qrText);
            qr.make();
            const scale = 8;
            const margin = 4;
            const count = qr.getModuleCount();
            const size = (count + margin * 2) * scale;
            const canvasEl = document.createElement('canvas');
            canvasEl.width = size;
            canvasEl.height = size;
            canvasEl.style.width = '80px';
            canvasEl.style.height = '80px';
            const c = canvasEl.getContext('2d');
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, size, size);
            c.fillStyle = '#000000';
            for (let r = 0; r < count; r++) {
                for (let col = 0; col < count; col++) {
                    if (qr.isDark(r, col)) {
                        c.fillRect((col + margin) * scale, (r + margin) * scale, scale, scale);
                    }
                }
            }
            el.appendChild(canvasEl);
            return true;
        }

        // Fallback: legacy qrcodejs (kept only if CDN above is blocked)
        if (typeof QRCode !== 'undefined') {
            new QRCode(el, {
                text: qrText,
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
            const img = el.querySelector('img');
            const cv = el.querySelector('canvas');
            if (img) { img.style.width = '80px'; img.style.height = '80px'; img.style.imageRendering = 'pixelated'; }
            if (cv) { cv.style.width = '80px'; cv.style.height = '80px'; }
            return true;
        }

        return false;
    }

    function waitForQrPaint() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const ok = !!document.getElementById('qrcode').querySelector('canvas, img, table');
                if (ok) return resolve();
                setTimeout(resolve, 150);
            }));
        });
    }

    function renderQR() {
        renderQRWithLib(buildQrPayload());
        return waitForQrPaint();
    }

    // 3. Render Flyer on Canvas
    const canvas = document.getElementById('flyer-canvas');
    const ctx = canvas.getContext('2d');
    const preview = document.getElementById('flyer-preview');

    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image: ' + src));
            img.src = src;
        });
    }

    // Draw image covering a rect (crops overflow, no gaps/letterboxing)
    function drawImageCover(context, img, x, y, w, h) {
        const imgRatio = img.width / img.height;
        const rectRatio = w / h;
        let sw, sh, sx, sy;
        if (imgRatio > rectRatio) {
            sh = img.height; sw = sh * rectRatio; sx = (img.width - sw) / 2; sy = 0;
        } else {
            sw = img.width; sh = sw / rectRatio; sx = 0; sy = (img.height - sh) / 2;
        }
        context.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }

    async function renderFlyer() {
        const bgImg = await loadImage('assets/originial concert 3 im attending.png');

        // 1. Draw User Portrait FIRST (so it's behind the background frame).
        // Enlarged + pulled up so it fills the frame opening (no gap top-right).
        if (attendee.photo) {
            const userImg = await loadImage(attendee.photo);
            drawImageCover(ctx, userImg, 200, 130, 680, 700);
        }

        // 2. Draw Background Image SECOND (acts as an overlay/frame)
        ctx.drawImage(bgImg, 0, 0, 1080, 1350);

        preview.src = canvas.toDataURL('image/png');
        await new Promise((resolve) => {
            if (preview.complete && preview.naturalWidth) return resolve();
            preview.onload = () => resolve();
            preview.onerror = () => resolve();
        });
    }

    // Load ticket QR + flyer together, then reveal both simultaneously
    try {
        await Promise.all([renderQR(), renderFlyer()]);
    } catch (err) {
        try { await renderQR(); } catch (e) { /* show ticket anyway */ }
    } finally {
        if (loader) loader.classList.add('hidden');
        if (container) container.classList.add('ready');
    }

    // 4. Export Actions
    document.getElementById('btn-download-flyer').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = `OC3_Flyer_${attendee.fullName}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
    });

    document.getElementById('btn-pdf').addEventListener('click', async () => {
        const { jsPDF } = window.jspdf;
        const element = document.getElementById('ticket-capture-area');
        const canvasTicket = await html2canvas(element, {
            scale: 3,
            useCORS: true,
            backgroundColor: null
        });

        const imgData = canvasTicket.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF('p', 'mm', 'a4');

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        const xOffset = 0;
        const yOffset = (pdf.internal.pageSize.getHeight() - pdfHeight) / 2;

        pdf.addImage(imgData, 'JPEG', xOffset, yOffset, pdfWidth, pdfHeight);
        pdf.save(`OC3_Ticket_${attendee.fullName}.pdf`);
    });

    // 5. Share Logic (native share + social deep links, flyer image attached when possible)
    const siteUrl = 'https://original-concert.vercel.app';
    const shareText = `I’m attending Original Concert 3.0. Join me this October in Nsugbe!`;
    const shareFullText = `${shareText} Get your tickets: ${siteUrl}`;

    document.getElementById('share-message').innerText = shareText;
    document.getElementById('share-whatsapp').href = `https://wa.me/?text=${encodeURIComponent(shareFullText)}`;
    document.getElementById('share-facebook').href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(siteUrl)}&quote=${encodeURIComponent(shareFullText)}`;

    document.getElementById('btn-copy-link').addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(shareFullText);
            alert('Link copied to clipboard!');
        } catch (e) {
            const tmp = document.createElement('textarea');
            tmp.value = shareFullText;
            document.body.appendChild(tmp);
            tmp.select();
            document.execCommand('copy');
            tmp.remove();
            alert('Link copied to clipboard!');
        }
    });

    async function getFlyerFile() {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                if (!blob) return resolve(null);
                resolve(new File([blob], `OC3_Flyer_${attendee.fullName}.png`, { type: 'image/png' }));
            }, 'image/png');
        });
    }

    async function getSocialImageFile() {
        try {
            const res = await fetch('assets/originial concert 3 all artists.png');
            const blob = await res.blob();
            return new File([blob], 'original-concert-3-all-artists.png', { type: blob.type || 'image/png' });
        } catch (e) {
            return null;
        }
    }

    document.getElementById('btn-share').addEventListener('click', async () => {
        const files = [];
        const flyerFile = await getFlyerFile();
        const socialFile = await getSocialImageFile();
        if (flyerFile) files.push(flyerFile);
        else if (socialFile) files.push(socialFile);

        const shareData = { title: 'Original Concert 3.0', text: shareFullText, url: siteUrl };
        if (files.length && navigator.canShare && navigator.canShare({ files })) {
            shareData.files = files;
        }

        if (navigator.share) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) {
                if (err && err.name === 'AbortError') return;
            }
        }

        // Fallback: open WhatsApp share sheet ready to send
        window.open(`https://wa.me/?text=${encodeURIComponent(shareFullText)}`, '_blank', 'noopener');
    });
});
