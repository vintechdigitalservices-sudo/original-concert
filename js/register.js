document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('upload-area');
    const photoInput = document.getElementById('photo-input');
    const cropModal = document.getElementById('crop-modal');
    const cropImage = document.getElementById('crop-image');
    const btnCancelCrop = document.getElementById('btn-cancel-crop');
    const btnConfirmCrop = document.getElementById('btn-confirm-crop');
    const profilePreview = document.getElementById('profile-preview');
    const registrationForm = document.getElementById('registration-form');
    const loadingOverlay = document.getElementById('loading');

    let cropper = null;
    let croppedImageData = null;

    // Trigger file input
    uploadArea.addEventListener('click', () => photoInput.click());

    // Handle file selection
    photoInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File size exceeds 5MB limit.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            cropImage.src = event.target.result;
            cropModal.style.display = 'flex';

            if (cropper) cropper.destroy();
            cropper = new Cropper(cropImage, {
                aspectRatio: 1,
                viewMode: 1,
                autoCropArea: 1,
            });
        };
        reader.readAsDataURL(file);
    });

    // Cancel crop
    btnCancelCrop.addEventListener('click', () => {
        cropModal.style.display = 'none';
        photoInput.value = '';
    });

    // Confirm crop
    btnConfirmCrop.addEventListener('click', () => {
        if (!cropper) return;

        const canvas = cropper.getCroppedCanvas({
            width: 400,
            height: 400
        });

        croppedImageData = canvas.toDataURL('image/jpeg', 0.9);
        profilePreview.src = croppedImageData;
        profilePreview.style.display = 'block';
        document.getElementById('upload-text').innerText = 'Photo uploaded successfully!';

        cropModal.style.display = 'none';
    });

    // Helper: guarantee the loading overlay never hangs forever by racing the
    // Firestore request against a hard timeout.
    const withTimeout = (promise, ms, message) =>
        Promise.race([
            promise,
            new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms))
        ]);

    // Registration Submission
    registrationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log('[Registration] Submit triggered');

        if (!croppedImageData) {
            alert('Please upload and crop your photo first.');
            return;
        }

        const fullName = document.getElementById('fullName').value.trim();
        const phone = document.getElementById('phone').value.trim();
        const email = document.getElementById('email').value.trim();

        console.log('[Registration] Validating fields...', { fullName, phone, email });

        // Simple Nigerian phone validation (starts with 0 or +234)
        const phoneRegex = /^(?:\+234|0)[789]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            alert('Please enter a valid Nigerian phone number.');
            return;
        }

        loadingOverlay.style.display = 'flex';
        console.log('[Registration] Loading overlay shown');

        try {
            if (!window.db) {
                console.error('[Registration] window.db is undefined');
                throw new Error('Database is not ready. Please check your connection and try again.');
            }

            // Ticket ID Generation (unique, human-readable)
            const ticketId = 'OC26-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
            const attendeeId = 'ATT-' + Date.now();
            console.log('[Registration] Generated Ticket ID:', ticketId);

            // Save record to Firestore `tickets` collection.
            // Including the portrait image as Base64 so it's recoverable on other devices.
            const ticketRecord = {
                id: attendeeId,
                ticketId: ticketId,
                fullName: fullName,
                phone: phone,
                email: email,
                photo: croppedImageData,
                createdAt: new Date().toISOString()
            };

            console.log('[Registration] Attempting Firestore write for:', ticketId);
            try {
                await withTimeout(
                    window.db.collection('tickets').doc(ticketId).set(ticketRecord),
                    20000,
                    'The database request timed out after 20 seconds.'
                );
                console.log('[Registration] Firestore write successful');
            } catch (dbErr) {
                console.error('[Registration] Firestore write failed:', dbErr);
                const reason = (dbErr && dbErr.message ? dbErr.message : String(dbErr)) || 'Unknown database error.';
                alert('Could not save your registration to the database:\n\n' + reason);
                loadingOverlay.style.display = 'none';
                return;
            }

            const attendeeData = {
                ...ticketRecord,
                photo: croppedImageData
            };

            localStorage.setItem('currentAttendee', JSON.stringify(attendeeData));
            console.log('[Registration] Data saved to localStorage');

            console.log('[Registration] Navigating to ticket page...');
            window.location.href = 'ticket.html';
        } catch (err) {
            console.error('[Registration] Unexpected error during submission:', err);
            alert('Could not save your registration. Please check your connection and try again.');
            loadingOverlay.style.display = 'none';
        }
    });
});
