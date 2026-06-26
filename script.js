document.getElementById('paymentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Grab inputs
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const phoneNumber = document.getElementById('phoneNumber').value;

    // Show loading spinner setup
    document.getElementById('formContainer').style.display = 'none';
    document.getElementById('toastNotice').style.display = 'flex';
    document.getElementById('iframeWrapper').style.display = 'block';

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, phoneNumber })
        });

        const data = await response.json();

        if (data.success && data.redirect_url) {
            // Hide custom loading animation and point iframe directly to Pesapal checkout
            document.getElementById('loadingDots').style.display = 'none';
            const iframe = document.getElementById('pesapalIframe');
            iframe.src = data.redirect_url;
            iframe.style.display = 'block';
        } else {
            alert('Failed to launch checkout portal. Check credentials.');
            resetForm();
        }
    } catch (error) {
        console.error(error);
        alert('An network communication error occurred.');
        resetForm();
    }
});

function resetForm() {
    document.getElementById('formContainer').style.display = 'block';
    document.getElementById('toastNotice').style.display = 'none';
    document.getElementById('iframeWrapper').style.display = 'none';
}document.getElementById('paymentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Grab inputs
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const phoneNumber = document.getElementById('phoneNumber').value;

    // Show loading spinner setup
    document.getElementById('formContainer').style.display = 'none';
    document.getElementById('toastNotice').style.display = 'flex';
    document.getElementById('iframeWrapper').style.display = 'block';

    try {
        const response = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, phoneNumber })
        });

        const data = await response.json();

        if (data.success && data.redirect_url) {
            // Hide custom loading animation and point iframe directly to Pesapal checkout
            document.getElementById('loadingDots').style.display = 'none';
            const iframe = document.getElementById('pesapalIframe');
            iframe.src = data.redirect_url;
            iframe.style.display = 'block';
        } else {
            alert('Failed to launch checkout portal. Check credentials.');
            resetForm();
        }
    } catch (error) {
        console.error(error);
        alert('An network communication error occurred.');
        resetForm();
    }
});

function resetForm() {
    document.getElementById('formContainer').style.display = 'block';
    document.getElementById('toastNotice').style.display = 'none';
    document.getElementById('iframeWrapper').style.display = 'none';
}
